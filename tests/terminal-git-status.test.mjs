import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture() {
  const nodes = Object.fromEntries(['git-status','git-message','git-info'].map(id=>[id,{textContent:'',title:''}]));
  let Card;
  const document={hidden:false,addEventListener(){},removeEventListener(){}};
  const context={HTMLElement:class { attachShadow(){this.shadowRoot={getElementById:id=>nodes[id]};} },
    document,window:{},TextDecoder,setTimeout:()=>1,clearTimeout(){},
    customElements:{define(name,type){Card=type;}}};
  vm.runInNewContext(fs.readFileSync('custom_components/carrot_ha/frontend/carrot-terminal-card.js','utf8'),context);
  const card=new Card();card.isConnected=true;
  return {card,nodes,document};
}

test('offline comparison uses safe text and shows last observation basis',()=>{
  const {card,nodes}=fixture();
  card._gitStatus={installed_commit:'a'.repeat(40),latest_commit:'b'.repeat(40),behind:5,ahead:0,
    comparison:'ahead',latest_message:'<img src=x onerror=alert(1)>\nBody',installed_measured_at:'2026-10-11T00:00:00Z'};
  card._paintGitStatus();
  assert.match(nodes['git-status'].textContent,/5개 커밋 뒤처짐/);
  assert.match(nodes['git-status'].textContent,/마지막 기기 보고 기준/);
  assert.match(nodes['git-message'].textContent,/<img/);
  assert.match(nodes['git-info'].title,/기기 마지막 보고/);
  assert.match(nodes['git-message'].title,/Body/);
});

test('works without terminal ready and stops remote calls when hidden',async()=>{
  const {card,document,nodes}=fixture();let calls=0;
  card._config={device_id:'vehicle'};
  card._hass={callWS:async()=>{calls++;return {latest_commit:'b'.repeat(40),latest_message:'Latest'};}};
  await card._refreshGitStatus();
  assert.equal(calls,1);assert.match(nodes['git-status'].textContent,/설치 커밋 미확인/);
  assert.match(nodes['git-message'].textContent,/Latest/);
  document.hidden=true;await card._refreshGitStatus();assert.equal(calls,1);
});

test('ignores stale response after device change',async()=>{
  const {card}=fixture();let resolve;
  card._config={device_id:'vehicle'};
  card._hass={callWS:()=>new Promise(r=>resolve=r)};
  const request=card._refreshGitStatus();card._gitRequest++;
  resolve({latest_message:'Wrong vehicle'});await request;
  assert.equal(card._gitStatus.latest_message,undefined);
});

test('commit row lies below workflow buttons and above terminal keys',()=>{
  const source=fs.readFileSync('custom_components/carrot_ha/frontend/carrot-terminal-card.js','utf8');
  assert.ok(source.indexOf('<div id="git-info"')>source.indexOf('<button id="btn-reboot"'));
  assert.ok(source.indexOf('<div id="git-info"')<source.indexOf('<!-- Navigation & Helper Keys -->'));
});
