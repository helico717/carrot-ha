// Existing YAML now opens parameter tuning again. Logs use carrot-logs-card.
import CarrotParameterTuningCard from './carrot-parameter-tuning-card.js';
class CarrotParamsCompat extends CarrotParameterTuningCard {}
if (!customElements.get('carrot-params-card')) customElements.define('carrot-params-card', class extends CarrotParamsCompat {});
window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'carrot-params-card')) window.customCards.push({type:'carrot-params-card', name:'Carrot HA — 파라미터 설정', description:'차량 파라미터 조회·변경 및 적용 확인'});
export default CarrotParamsCompat;
