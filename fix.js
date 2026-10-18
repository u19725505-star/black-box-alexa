(function(){
  var realSpeak=speak, t0=Date.now();
  speak=function(t){
    if(Date.now()-t0<2000)return;
    if(listening)return;
    realSpeak(t);
  };
  document.addEventListener('pointerdown',function(e){
    if(e.target.closest&&e.target.closest('#mic')){
      e.stopImmediatePropagation();
    }
  },true);
})();
/* END */
