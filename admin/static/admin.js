document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.open).showModal()));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
document.querySelectorAll('.edit-entry').forEach(b=>b.addEventListener('click',()=>{const d=JSON.parse(b.dataset.row),m=document.getElementById('entry-modal'),f=m.querySelector('form');Object.entries(d).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v??''});m.showModal()}));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}));

