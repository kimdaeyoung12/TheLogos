import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioFade} from '../static/retreat-prayer/assets/audio-fade.js';

function fixture(volume = 0.8) {
  const audio = {volume};
  let time = 0;
  let next = 0;
  const callbacks = new Map();
  const fade = createAudioFade(audio, {
    now: () => time,
    setTimer: (fn) => { callbacks.set(++next, fn); return next; },
    clearTimer: (id) => callbacks.delete(id),
  });
  return {audio, fade, callbacks, advance(ms) {
    time += ms;
    const pending = [...callbacks.values()]; callbacks.clear();
    pending.forEach(fn => fn());
  }};
}

test('playback fades from silence to the original volume over 1.5 seconds', () => {
  const f = fixture();
  const token = f.fade.prepare();
  assert.equal(f.audio.volume, 0);
  f.fade.start(token);
  f.advance(750);
  assert.equal(f.audio.volume, 0.4);
  f.advance(750);
  assert.equal(f.audio.volume, 0.8);
  assert.equal(f.callbacks.size, 0);
});

test('stop restores normal volume and invalidates pending playback', () => {
  const f = fixture(); const token = f.fade.prepare();
  f.fade.start(token); f.advance(300); f.fade.cancel();
  assert.equal(f.audio.volume, 0.8);
  f.fade.start(token); f.advance(2000);
  assert.equal(f.audio.volume, 0.8);
  assert.equal(f.callbacks.size, 0);
  assert.equal(f.fade.isCurrent(token), false);
});

test('rapid track changes ignore the previous play result and keep target volume', () => {
  const f = fixture(); const oldToken = f.fade.prepare();
  f.fade.start(oldToken); f.advance(300);
  const current = f.fade.prepare();
  f.fade.start(oldToken); assert.equal(f.callbacks.size, 0);
  f.fade.start(current); f.advance(1500);
  assert.equal(f.audio.volume, 0.8);
});

test('a throttled background timer catches up and a muted target stays muted', () => {
  for (const volume of [0, 0.6]) {
    const f = fixture(volume); f.fade.start(f.fade.prepare());
    f.advance(5000); assert.equal(f.audio.volume, volume);
    assert.equal(f.callbacks.size, 0);
  }
});

test('read-only element volume uses a reusable Web Audio gain and resumes on a gesture', async () => {
  const audio = {get volume() {return 1;}, set volume(value) {}};
  let time = 0, callback, sources = 0, resumes = 0;
  const gain = {gain: {value:1}, connect() {}};
  class Context {
    state = 'suspended'; destination = {};
    createGain() {return gain;}
    createMediaElementSource() {sources++;return {connect() {}};}
    resume() {resumes++;this.state='running';return Promise.resolve();}
  }
  const fade=createAudioFade(audio,{AudioContextClass:Context,now:()=>time,setTimer:fn=>(callback=fn,1),clearTimer:()=>{callback=null;}});
  const token=fade.prepare(); await fade.whenReady();
  assert.equal(audio.crossOrigin,'anonymous');assert.equal(gain.gain.value,0);
  fade.start(token);time=750;callback();assert.equal(gain.gain.value,0.5);
  time=1500;callback();assert.equal(gain.gain.value,1);
  fade.cancel();fade.prepare();assert.equal(sources,1);assert.equal(resumes,1);
  fade.cancel();assert.equal(gain.gain.value,1);
});

test('failed Web Audio source setup does not poison a later retry', () => {
  const audio={get volume(){return 1;},set volume(value){}};
  let attempts=0,closed=0;
  class Context {
    state='running';destination={};
    createGain(){return {gain:{value:1},connect(){}};}
    createMediaElementSource(){if(++attempts===1)throw Error('setup failed');return {connect(){}};}
    close(){closed++;return Promise.resolve();}
  }
  const fade=createAudioFade(audio,{AudioContextClass:Context});
  assert.throws(()=>fade.prepare(),/setup failed/);fade.cancel();
  assert.doesNotThrow(()=>fade.prepare());fade.cancel();
  assert.equal(attempts,2);assert.equal(closed,1);
});
