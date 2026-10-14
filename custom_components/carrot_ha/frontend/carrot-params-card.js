// Preserve existing Lovelace YAML and resource URLs while replacing the view.
import CarrotLogsCard from './carrot-logs-card.js';
class CarrotParamsCompat extends CarrotLogsCard {}
if (!customElements.get('carrot-params-card')) customElements.define('carrot-params-card', class extends CarrotParamsCompat {});
window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'carrot-params-card')) window.customCards.push({type:'carrot-params-card', name:'Carrot HA — 당근웹 로그', description:'HA에 보관된 최신 주행 로그와 영상 조회'});
export default CarrotParamsCompat;
