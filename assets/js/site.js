
document.addEventListener('DOMContentLoaded',()=>{
 const btn=document.querySelector('.menu-toggle'),nav=document.querySelector('.nav');
 if(btn&&nav){btn.addEventListener('click',()=>{const open=nav.classList.toggle('open');btn.setAttribute('aria-expanded',open?'true':'false');});}
 const year=document.querySelectorAll('[data-year]');year.forEach(e=>e.textContent=new Date().getFullYear());
});
