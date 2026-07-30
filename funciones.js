/*
  ZHAICOLEX INSPIRATIONS — Loader universal
  --------------------------------------------------
  Que hace este script:
  1. Inyecta el HTML/CSS del loader automaticamente (no hay que pegarlo en cada pagina).
  2. Intercepta TODAS las llamadas fetch() del sitio (incluidas las de Supabase,
     que usa fetch por debajo) y muestra el loader mientras estan en curso.
  3. Lleva un contador de peticiones activas, para que si hay 2 o 3 peticiones
     al mismo tiempo, el loader no desaparezca hasta que TODAS terminen.
  4. Expone window.mostrarLoader() / window.ocultarLoader() por si quieres
     activarlo manualmente para algo que no sea una peticion de red
     (por ejemplo, mientras procesas o renderizas algo pesado).

  COMO USARLO:
  Solo agrega esta linea en tu HTML, antes de cualquier otro script que haga
  peticiones (Supabase, tus fetch, etc):

    <script src="zhaicolex-loader.js"></script>

  Eso es todo. No necesitas tocar tus funciones existentes de Supabase.
*/

(function () {

    // ---------- 1. INYECTAR ESTILOS ----------
    const estilos = document.createElement('style');
    estilos.textContent = `
      #zx-loader-overlay {
        position: fixed;
        inset: 0;
        background: #0a0a0a;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.5s ease;
        font-family: 'Montserrat', sans-serif;
      }
      #zx-loader-overlay.zx-visible {
        opacity: 1;
        pointer-events: all;
      }
      .zx-scene { position: relative; width: 220px; height: 260px; }
      .zx-mist {
        position: absolute; top: 18px; left: 50%; transform: translateX(-50%);
        width: 6px; height: 6px; border-radius: 50%;
        background: radial-gradient(circle, rgba(214,178,110,0.9) 0%, rgba(214,178,110,0) 70%);
        animation: zx-puff 2.6s ease-out infinite; opacity: 0;
      }
      .zx-mist:nth-child(1) { animation-delay: 0s; }
      .zx-mist:nth-child(2) { animation-delay: 0.5s; margin-left: -14px; }
      .zx-mist:nth-child(3) { animation-delay: 1s; margin-left: 14px; }
      .zx-mist:nth-child(4) { animation-delay: 1.5s; margin-left: -6px; }
      .zx-mist:nth-child(5) { animation-delay: 2s; margin-left: 8px; }
      @keyframes zx-puff {
        0%   { opacity: 0; transform: translate(-50%, 0) scale(0.4); }
        15%  { opacity: 0.9; }
        100% { opacity: 0; transform: translate(-50%, -90px) scale(3.2); }
      }
      .zx-bulb {
        position: absolute; top: 4px; left: 50%; transform: translateX(-50%);
        width: 22px; height: 22px; border-radius: 50%; background: #d6b26e;
        animation: zx-squeeze 2.6s ease-in-out infinite;
      }
      @keyframes zx-squeeze {
        0%, 100% { transform: translateX(-50%) scale(1); }
        10%      { transform: translateX(-50%) scale(0.82); }
        20%      { transform: translateX(-50%) scale(1); }
      }
      .zx-stem {
        position: absolute; top: 26px; left: 50%; transform: translateX(-50%);
        width: 3px; height: 30px; background: rgba(255,255,255,0.35);
      }
      .zx-bottle {
        position: absolute; top: 70px; left: 50%; transform: translateX(-50%);
        width: 90px; height: 130px;
        border: 1.5px solid rgba(214,178,110,0.55);
        border-radius: 4px 4px 14px 14px;
        overflow: hidden; background: rgba(255,255,255,0.02);
      }
      .zx-bottle::before {
        content: ''; position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
        width: 26px; height: 14px;
        border: 1.5px solid rgba(214,178,110,0.55); border-bottom: none; background: #0a0a0a;
      }
      .zx-liquid {
        position: absolute; bottom: 0; left: 0; width: 100%; height: 0%;
        background: linear-gradient(180deg, rgba(214,178,110,0.85), rgba(158,120,58,0.95));
        animation: zx-fill 2.6s ease-in-out infinite;
      }
      .zx-liquid::before {
        content: ''; position: absolute; top: -3px; left: 0; width: 200%; height: 6px;
        background: rgba(255,255,255,0.15); border-radius: 50%;
        animation: zx-wave 1.8s linear infinite;
      }
      @keyframes zx-fill {
        0%   { height: 8%; }
        80%  { height: 78%; }
        100% { height: 78%; }
      }
      @keyframes zx-wave {
        0%   { transform: translateX(0); }
        100% { transform: translateX(-25%); }
      }
      .zx-brand {
        font-family: 'Cormorant Garamond', serif;
        font-size: 21px; font-weight: 500; letter-spacing: 3px;
        text-transform: uppercase; text-align: center; margin-top: 18px;
        color: #d6b26e;
      }
      .zx-brand span {
        display: block; font-size: 11px; letter-spacing: 4px;
        color: #fff; margin-top: 4px;
      }
      .zx-text {
        font-size: 10px; font-weight: 300; letter-spacing: 3px;
        text-transform: uppercase; color: rgba(255,255,255,0.5);
        text-align: center; margin-top: 6px;
      }
    `;
    document.head.appendChild(estilos);
  
    // Fuentes (si tu sitio ya las carga, no pasa nada por cargarlas de nuevo)
    const fuentes = document.createElement('link');
    fuentes.rel = 'stylesheet';
    fuentes.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Montserrat:wght@300;400;500&display=swap';
    document.head.appendChild(fuentes);
  
    // ---------- 2. INYECTAR HTML ----------
    const overlay = document.createElement('div');
    overlay.id = 'zx-loader-overlay';
    overlay.innerHTML = `
      <div class="zx-scene">
        <div class="zx-mist"></div>
        <div class="zx-mist"></div>
        <div class="zx-mist"></div>
        <div class="zx-mist"></div>
        <div class="zx-mist"></div>
        <div class="zx-bulb"></div>
        <div class="zx-stem"></div>
        <div class="zx-bottle"><div class="zx-liquid"></div></div>
      </div>
      <div class="zx-brand">Zhaicolex<span>Inspirations</span></div>
      <div class="zx-text">Cargando</div>
    `;
  
    // Se agrega al body cuando el DOM esta listo
    function agregarOverlay() {
      document.body.appendChild(overlay);
    }
    if (document.body) {
      agregarOverlay();
    } else {
      document.addEventListener('DOMContentLoaded', agregarOverlay);
    }
  
    // ---------- 3. CONTROL DE VISIBILIDAD ----------
    let peticionesActivas = 0;
  
    function mostrarLoader() {
      peticionesActivas++;
      overlay.classList.add('zx-visible');
    }
  
    function ocultarLoader() {
      peticionesActivas = Math.max(0, peticionesActivas - 1);
      if (peticionesActivas === 0) {
        overlay.classList.remove('zx-visible');
      }
    }
  
    // Se exponen por si se quieren llamar a mano en algun caso especial
    window.mostrarLoader = mostrarLoader;
    window.ocultarLoader = ocultarLoader;
  
    // ---------- 4. INTERCEPTAR TODAS LAS PETICIONES FETCH ----------
    // Esto cubre Supabase (usa fetch por debajo), tus propias llamadas a APIs,
    // carga de imagenes via fetch, etc. No necesitas modificar tu codigo existente.
    const fetchOriginal = window.fetch;
  
    window.fetch = function (...args) {
      mostrarLoader();
      return fetchOriginal.apply(this, args)
        .then((respuesta) => {
          ocultarLoader();
          return respuesta;
        })
        .catch((error) => {
          ocultarLoader();
          throw error;
        });
    };
  
  })();