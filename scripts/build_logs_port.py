from pathlib import Path
import subprocess,re,json
import argparse
args=argparse.ArgumentParser()
args.add_argument('--openpilot-root', required=True, type=Path)
args.add_argument('--ref', default='HEAD')
args=args.parse_args()
src=args.openpilot_root
dst=Path(__file__).resolve().parents[1]/'custom_components/carrot_ha/frontend/carrot_logs'
ref=subprocess.check_output(['git','rev-parse',args.ref],cwd=src,text=True).strip()
def read(name):
 return subprocess.check_output(['git','show',ref+':openpilot/selfdrive/carrot/web/'+name],cwd=src)
assets=['js/generated/app.js','js/generated/logs.js','js/translations/registry.js','js/translations/ko.js','js/translations/en.js','js/shared/ui/media_transport.js','css/generated/design-tokens.css','css/tokens.css','css/layout_tokens.css','css/hud_card.css','css/base.css','css/layout.css','css/generated/design-system.css','css/components.css','css/components/media_transport.css','css/responsive.css','css/generated/logs.css']
for name in assets:
 out=dst/name;out.parent.mkdir(parents=True,exist_ok=True)
 data=read(name)
 if name=='js/generated/logs.js':
  text=data.decode()
  text,count=re.subn(r'return(`/api/dashcam/\$\{[^}]+\}/\$\{encodeURIComponent\([^)]+\)\}`)',r'return window.carrotLogsURL(\1)',text)
  assert count==1,count
  data=text.encode()
 out.write_bytes(data)
text=read('index.html').decode();a=text.index('    <div id="pageLogs"');b=text.index('    <!-- ════════════ CARROT TEST',a)
page=text[a:b].replace(' hidden style="display:none;"','')
links='\n'.join('<link rel="stylesheet" href="'+name+'">' for name in assets if name.endswith('.css'))
scripts='\n'.join('<script src="'+name+'"></script>' for name in ['js/translations/registry.js','js/translations/ko.js','js/translations/en.js','js/generated/app.js','js/shared/ui/media_transport.js','ha_logs_bridge.js','js/generated/logs.js'])
html='''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>당근웹 로그 · HA</title>'''+links+'''<style>html,body{height:100%;margin:0;overflow:hidden}body{display:flex;flex-direction:column;background:var(--md-surface,#121316)}:root{--nav-bar-height:0px;--nav-bar-height-desktop:0px}.page--logs{display:flex!important;flex:1;min-height:0;padding:0}.logs-shell{height:100%;min-height:0}#haLogsStatus{padding:10px 14px;font-size:12px;flex:none;border-bottom:1px solid #444}#haLogsStatus button{margin-left:8px}#haLogsError{color:#ffb4ab}#logsScreenPanel:before{content:'화면 녹화 동기화는 다음 단계에서 연결됩니다.';display:block;padding:16px}</style></head><body><div id="haLogsStatus" role="status">HA 로그 연결 중…</div>'''+page+text[text.index('  <div id="appToastHost"'):text.index('  <div id="appBranchPicker"',text.index('  <div id="appToastHost"'))]+scripts+'''<script src="ha_log_thumbnails.js"></script><script src="ha_replay_loader.js"></script><script>window.parent.postMessage({type:'carrot:logs_ready'},location.origin);</script></body></html>'''
(dst/'logs.html').write_text(html)
(dst/'SOURCE.md').write_text('# 당근웹 로그 UI 원본\n\nopenpilot commit: `'+ref+'`\n\n`openpilot/selfdrive/carrot/web/`의 로그 HTML·생성된 UI/로그 번들·스타일을 재사용한다.\n생성 로그 번들의 파일 URL 함수만 HA 장치 범위 URL 변환기로 연결한다.\n추가 브리지와 카드의 API는 HA 로컬을 사용한다.\n')
print('ported',ref)

replay_assets=['js/generated/replay.js','js/realtime/replay_client.js','js/realtime/vision_replay.js','js/realtime/replay_log_worker.js','js/realtime/replay_video_worker.js','js/realtime/replay_advanced_worker.js','js/realtime/replay_sensor_worker.js','js/realtime/raw_capnp.js','js/realtime/vision_compact.js','js/vendor/fzstd.js','js/vendor/seek-bzip.js','js/vendor/mux-mp4.js','css/generated/replay.css','css/generated/drive.css','css/pages/drive.css','css/components/drive_workspace.css']
for name in replay_assets:
 data=read(name).decode()
 data=data.replace('"/js/','"/carrot_ha_static/carrot_logs/js/').replace("'/js/","'/carrot_ha_static/carrot_logs/js/")
 if name=='js/realtime/replay_client.js':
  data=data.replace('fetch(`/api/dashcam/replay-source/${encodeURIComponent(segment)}`,','fetch(window.carrotLogsURL(`/api/dashcam/replay-source/${encodeURIComponent(segment)}`),')
 p=dst/name;p.parent.mkdir(parents=True,exist_ok=True);
 if name=='js/realtime/vision_replay.js':
  data=data.replace('window.CarrotVisionReplay = window.CarrotVisionReplay ||','window.CarrotHAReplayRuntime = window.CarrotHAReplayRuntime ||',1)
 p.write_text(data)

index=read('index.html').decode()
a=index.index('    <div id="pageCarrot"');b=index.index('  <section id="carrotMiniHud"',a)
page=index[a:b].rstrip().rsplit('  </div>',1)[0]
(dst/'replay_page.html').write_text(page)
