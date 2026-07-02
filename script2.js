
/* Ultra lite runtime guard */
(function(){
  document.documentElement.classList.add('ultra-lite');
  document.addEventListener('DOMContentLoaded', function(){
    // mode tampilan tetap mengikuti admin panel, jangan dipaksa ringan
    document.querySelectorAll('img').forEach(function(img){
      if(!img.closest('.hero-fixed-media')){ img.loading='lazy'; img.decoding='async'; }
    });
    document.querySelectorAll('video').forEach(function(v){
      v.muted=true; v.loop=true; v.autoplay=true; v.playsInline=true; v.preload='metadata';
      v.removeAttribute('controls');
      var play=function(){ v.play && v.play().catch(function(){}); };
      play(); setTimeout(play,300); setTimeout(play,1200);
    });
  });
})();
