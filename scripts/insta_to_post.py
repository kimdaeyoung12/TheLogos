"""
Instagram to Hugo Post Automation Script
=========================================

Instagram 링크를 파일에서 읽어 Hugo 게시물을 자동 생성합니다.
이미지는 다운로드하지 않고 Instagram embed shortcode를 사용합니다.

사용법:
1. scripts/.env 파일에 GEMINI_API_KEY 설정
2. scripts/instagram_links.txt 파일에 Instagram 링크를 한 줄씩 작성
3. python scripts/insta_to_post.py 실행

필요 패키지:
pip install instaloader google-generativeai python-dotenv

생성되는 파일:
content/posts/제목.md (단일 파일, 폴더 없음)
"""

import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    import instaloader
except ImportError:
    print("❌ instaloader 패키지가 필요합니다: pip install instaloader")
    sys.exit(1)

try:
    import google.generativeai as genai
except ImportError:
    print("❌ google-generativeai 패키지가 필요합니다: pip install google-generativeai")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("❌ python-dotenv 패키지가 필요합니다: pip install python-dotenv")
    sys.exit(1)

# ============================================================
# 설정
# ============================================================
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
CONTENT_DIR = PROJECT_ROOT / "content" / "posts"
LINKS_FILE = SCRIPT_DIR / "instagram_links.txt"
ENV_FILE = SCRIPT_DIR / ".env"

# .env 파일 로드
load_dotenv(ENV_FILE)

# Gemini 모델 설정
GEMINI_MODEL = "gemini-2.0-flash"


# ============================================================
# Instagram 데이터 추출
# ============================================================
def extract_shortcode(url: str) -> Optional[str]:
    """Instagram URL에서 shortcode 추출"""
    patterns = [
        r'instagram\.com/p/([A-Za-z0-9_-]+)',
        r'instagram\.com/reel/([A-Za-z0-9_-]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


# ============================================================
# AI 요약 생성
# ============================================================
def generate_ai_summary(caption: str, api_key: str) -> dict:
    """Gemini API로 AI 요약, 태그, mentions 생성"""
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(GEMINI_MODEL)
    
    prompt = f"""당신은 철학적 블로그 "The Logos"의 편집자입니다.
다음 Instagram 게시물을 분석하여 블로그 게시물 메타데이터를 생성해주세요.

## 게시물 원문:
\"\"\"
{caption}
\"\"\"

## 좋은 예시 (참고):
- 제목: "썰물" (간결하고 핵심 주제를 나타냄)
- 요약: "힘의 정의는 변화를 일으키는 원인이다. 생명은 엔트로피를 역행해 질서를 만든다."
- 태그: ["바다", "썰물", "질서", "생명", "엔트로피"]
- mentions: ["Entropy", "Second Law of Thermodynamics", "Order", "Life Force"]

## 작성 지침:
1. **title**: 글의 핵심 주제나 메타포를 1-3 단어로 (해시태그 아님, 한국어)
2. **summary**: 글의 철학적 메시지를 1-3문장으로 요약 (단순 축약이 아닌 핵심 통찰)
3. **tags**: 글의 주요 개념/키워드 3-5개 (한국어, 해시태그 기호 없이)
4. **mentions**: 관련 학술 용어나 개념 3-5개 (영어)
5. **category**: religion, philosophy, engineering, writing 중 하나

## 응답 형식 (JSON만):
{{
    "title": "철학적 제목",
    "summary": "핵심 메시지 요약",
    "tags": ["태그1", "태그2", "태그3"],
    "mentions": ["Concept1", "Concept2"],
    "category": "category_name"
}}"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        import json
        if text.startswith("```"):
            text = re.sub(r'^```json?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)
        
        result = json.loads(text)
        result['title'] = re.sub(r'#', '', result['title']).strip()
        return result
        
    except Exception as e:
        print(f"⚠️ AI 요약 생성 실패, 기본값 사용: {e}")
        clean_first = re.sub(r'#\S+', '', caption.split('\n')[0]).strip()[:20] if caption else "기록"
        return {
            'title': clean_first or "기록",
            'summary': re.sub(r'#\S+', '', caption[:150]).strip(),
            'tags': ["기록"],
            'mentions': [],
            'category': "writing"
        }


# ============================================================
# Hugo 게시물 생성
# ============================================================
def create_hugo_post(
    title: str,
    shortcode: str,
    post_date: datetime,
    tags: list,
    mentions: list,
    summary: str,
    caption: str,
) -> Path:
    """Hugo 마크다운 게시물 생성 (Instagram embed 사용)"""
    
    tags_str = ', '.join(f'"{tag}"' for tag in tags)
    mentions_str = ', '.join(f'"{m}"' for m in mentions)
    
    # 해시태그 제거한 캡션
    clean_caption = re.sub(r'#\S+', '', caption).strip()
    # 연속 줄바꿈 정리
    clean_caption = re.sub(r'\n{3,}', '\n\n', clean_caption)
    
    # Instagram 게시물은 항상 writing 카테고리
    content = f'''+++
title = "{title}"
date = {post_date.strftime("%Y-%m-%dT%H:%M:%S+09:00")}
draft = false
categories = ["writing"]
tags = [{tags_str}]
mentions = [{mentions_str}]
+++
{{{{< instagram {shortcode} >}}}}

{{{{< ai_summary >}}}}
{summary}
{{{{< /ai_summary >}}}}

{clean_caption}
'''
    
    # 파일명 생성 (특수문자 제거)
    safe_title = re.sub(r'[<>:"/\\|?*]', '', title)
    md_path = CONTENT_DIR / f"{safe_title}.md"
    
    # 중복 확인
    if md_path.exists():
        print(f"⚠️ 이미 존재하는 파일: {md_path.name}")
        return None
    
    md_path.write_text(content, encoding='utf-8')
    return md_path


# ============================================================
# 메인 로직
# ============================================================
def process_instagram_link(url: str, api_key: str) -> bool:
    """단일 Instagram 링크 처리"""
    
    print(f"\n{'='*50}")
    print(f"📷 처리 중: {url}")
    
    # 1. Shortcode 추출
    shortcode = extract_shortcode(url)
    if not shortcode:
        print(f"❌ 유효하지 않은 Instagram URL: {url}")
        return False
    
    print(f"   Shortcode: {shortcode}")
    
    # 2. Instagram에서 캡션과 날짜 가져오기
    # 최소한의 요청만 하도록 설정
    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
    )
    try:
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        caption = post.caption or ""
        post_date = post.date_local
        print(f"   📅 게시일: {post_date.strftime('%Y-%m-%d')}")
    except Exception as e:
        print(f"❌ 포스트 정보 가져오기 실패: {e}")
        return False
    
    # 3. AI 요약 생성
    print("   🤖 AI 요약 생성 중...")
    ai_result = generate_ai_summary(caption, api_key)
    title = ai_result['title']
    print(f"   📝 제목: {title}")
    
    # 4. Hugo 게시물 생성
    md_path = create_hugo_post(
        title=title,
        shortcode=shortcode,
        post_date=post_date,
        tags=ai_result['tags'],
        mentions=ai_result['mentions'],
        summary=ai_result['summary'],
        caption=caption,
    )
    
    if md_path:
        print(f"   ✅ 완료: {md_path.relative_to(PROJECT_ROOT)}")
        return True
    return False


def main():
    """메인 함수"""
    
    print("="*60)
    print("📸 Instagram to Hugo Post Generator")
    print(f"   모델: {GEMINI_MODEL}")
    print("   방식: Instagram Embed (이미지 다운로드 없음)")
    print("="*60)
    
    # API 키 확인
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        print("\n❌ GEMINI_API_KEY가 설정되지 않았습니다.")
        print(f"   scripts/.env 파일에 추가하세요:")
        print(f"   GEMINI_API_KEY=your-api-key")
        sys.exit(1)
    
    # 링크 파일 확인
    if not LINKS_FILE.exists():
        print(f"\n📄 링크 파일 생성됨: {LINKS_FILE}")
        LINKS_FILE.write_text("# Instagram 링크를 한 줄씩 입력하세요\n# 예: https://www.instagram.com/p/ABC123/\n", encoding='utf-8')
        print("   파일에 Instagram 링크를 추가한 후 다시 실행하세요.")
        sys.exit(0)
    
    # 링크 읽기
    links = []
    for line in LINKS_FILE.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#'):
            links.append(line)
    
    if not links:
        print(f"\n⚠️ {LINKS_FILE}에 처리할 링크가 없습니다.")
        sys.exit(0)
    
    print(f"\n📋 처리할 링크: {len(links)}개")
    
    # 각 링크 처리
    success = 0
    for url in links:
        if process_instagram_link(url, api_key):
            success += 1
    
    print(f"\n{'='*60}")
    print(f"✅ 완료: {success}/{len(links)} 게시물 생성")
    
    # 처리된 링크 주석 처리
    if success > 0:
        new_content = []
        processed_count = 0
        for line in LINKS_FILE.read_text(encoding='utf-8').splitlines():
            stripped = line.strip()
            if stripped in links and processed_count < success:
                new_content.append(f"# [처리됨] {stripped}")
                processed_count += 1
            else:
                new_content.append(line)
        LINKS_FILE.write_text('\n'.join(new_content), encoding='utf-8')
        print("   처리된 링크는 주석 처리되었습니다.")


if __name__ == "__main__":
    main()
