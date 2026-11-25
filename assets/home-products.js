// Product values and dates supplied in the visual reference.
window.homeProductReference = {
  draws: {
    virada: {"color":"#00a94f","header":"#00a94f","amount":"1.000.000.000,00","short":"1 Bilh\u00e3o","contest":"3100","day":"Sexta-Feira","date":"01/01/2027","time":"11h00","close":"2026-12-31T20:00:00-03:00","price":"6,00"},
    mega: {"color":"#00a94f","header":"#00a94f","amount":"75.000.000,00","short":"75 Milh\u00f5es","contest":"3091","day":"Quinta-Feira","date":"26/11/2026","close":"2026-11-26T20:00:00-03:00","price":"6,00","time":"21h00"},
    facil: {"color":"#92278f","amount":"2.000.000,00","short":"2 Milh\u00f5es","contest":"3838","day":"Quarta-Feira","date":"25/11/2026","time":"21h00","close":"2026-11-25T20:00:00-03:00","price":"3,50"},
    quina: {"color":"#1d216d","amount":"50.000.000,00","short":"50 Milh\u00f5es","contest":"7173","day":"Domingo","date":"29/11/2026","price":"2,50","time":"11h00","close":"2026-11-28T20:00:00-03:00"},
    milionaria: {"color":"#2b327d","amount":"118.000.000,00","short":"118 Milh\u00f5es","contest":"410","day":"Quarta-Feira","date":"25/11/2026","close":"2026-11-25T20:00:00-03:00","price":"6,00","time":"21h00"},
    mania: {"color":"#ed7900","amount":"2.800.000,00","short":"2,8 Milh\u00f5es","contest":"3003","day":"Quarta-Feira","date":"25/11/2026","close":"2026-11-25T20:00:00-03:00","price":"3,00","pool":false,"time":"21h00"},
    timemania: {"color":"#00863d","header":"#fff200","button":"#fff200","amount":"30.500.000,00","short":"30,5 Milh\u00f5es","contest":"2473","day":"Quinta-Feira","date":"26/11/2026","close":"2026-11-26T20:00:00-03:00","price":"3,50","time":"21h00"},
    dupla: {"color":"#af2942","amount":"15.300.000,00","short":"15,3 Milh\u00f5es","contest":"3036","day":"Quarta-Feira","date":"25/11/2026","close":"2026-11-25T20:00:00-03:00","price":"3,00","time":"21h00"},
    loteca: {"color":"#f1162b","amount":"1.000.000,00","short":"1 Milh\u00e3o","contest":"1285","day":"S\u00e1bado","date":"28/11/2026","time":"16h00","label":"Apura\u00e7\u00e3o","close":"2026-11-28T16:00:00-03:00","price":"4,00","pool":false},
    dia: {"color":"#ad9718","header":"#e8c41e","amount":"100.000,00","short":"100 Mil","contest":"1356","day":"Quarta-Feira","date":"25/11/2026","close":"2026-11-25T20:00:00-03:00","price":"2,50","time":"21h00"},
    super: {"color":"#00863d","header":"#bddb29","button":"#85a332","amount":"700.000,00","short":"700 Mil","contest":"926","day":"Quarta-Feira","date":"25/11/2026","close":"2026-11-25T20:00:00-03:00","price":"3,00","time":"21h00"}
  },
  countdown(close) {
    const minutes = Math.ceil((Date.parse(close) - Date.now()) / 60000);
    if (minutes <= 0) return 'Apostas encerradas<br>para este concurso';
    const days = Math.floor(minutes / 1440);
    if (days >= 1) return `Apostas se encerram em ${days} ${days === 1 ? 'dia' : 'dias'}`;
    const hours = Math.floor(minutes / 60), remaining = minutes % 60;
    const text = hours ? `${hours} ${hours === 1 ? 'hora' : 'horas'} e ${remaining} minutos` : `${remaining} ${remaining === 1 ? 'minuto' : 'minutos'}`;
    return `Apostas se encerram em<br>${text}`;
  }
};
setInterval(() => {
  document.querySelectorAll('[data-product-close]').forEach(node => {
    node.innerHTML = window.homeProductReference.countdown(node.dataset.productClose);
  });
}, 60000);
