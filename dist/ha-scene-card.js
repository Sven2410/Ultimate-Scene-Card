/**
 * HA Scene Card — v3.0.0
 * Visuele editor ingebouwd — geen YAML nodig voor de admin.
 * Scenes opgeslagen in een HA Text helper (input_text), gedeeld tussen alle apparaten.
 */

const VERSION = '3.0.0';
const DEFAULTS = {
  icons: ['mdi:walk', 'mdi:candle', 'mdi:lightbulb-on'],
  names: ['Scene 1', 'Scene 2', 'Scene 3'],
};

/* ════════════════════════════════════════════
   VISUELE EDITOR  (zichtbaar voor de admin)
   ════════════════════════════════════════════ */

class HaSceneCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = { lights: [] };
    this._hass = null;
  }

  set hass(hass) { const first = !this._hass; this._hass = hass; if (first) this._render(); }

  setConfig(config) {
    const prevLen = this._config?.lights?.length ?? -1;
    this._config = { lights: [], ...config };
    if (!Array.isArray(this._config.lights)) this._config.lights = [];
    // Alleen re-renderen bij structuurwijziging of eerste render.
    // Niet bij gewone waardeveranderingen — anders verliest de gebruiker focus.
    if (prevLen === -1 || prevLen !== this._config.lights.length) {
      this._render();
    }
  }

  _fire() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config } },
      bubbles: true, composed: true,
    }));
  }

  _render() {
    if (!this._hass) return;

    const cfg    = this._config;
    const lights = cfg.lights || [];

    const allLights = Object.entries(this._hass.states)
      .filter(([id]) => id.startsWith('light.'))
      .map(([id, st]) => ({ id, name: st.attributes?.friendly_name || id }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const allInputTexts = Object.entries(this._hass.states)
      .filter(([id]) => id.startsWith('input_text.'))
      .map(([id, st]) => ({ id, name: st.attributes?.friendly_name || id }))
      .sort((a, b) => a.name.localeCompare(b.name));

    this.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        .editor { font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
        .section { margin-bottom: 20px; }
        .label {
          display: block; font-size: 12px; font-weight: 500;
          color: var(--secondary-text-color); margin-bottom: 6px;
          text-transform: uppercase; letter-spacing: .06em;
        }
        select, input[type=text] {
          width: 100%; padding: 8px 10px;
          border: 1px solid var(--divider-color, #ddd); border-radius: 8px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color); font-size: 14px;
          appearance: none; -webkit-appearance: none;
        }
        select:focus, input[type=text]:focus {
          outline: none; border-color: var(--primary-color);
        }
        .hint {
          font-size: 12px; color: var(--secondary-text-color);
          margin-top: 5px; line-height: 1.5;
        }
        .hint strong { color: var(--primary-text-color); }
        .light-row {
          display: grid;
          grid-template-columns: 1fr 110px 34px;
          gap: 6px; margin-bottom: 8px; align-items: center;
        }
        .btn-del {
          width: 34px; height: 34px; border-radius: 8px;
          border: 1px solid var(--divider-color, #ddd);
          background: none; cursor: pointer;
          color: var(--error-color, #f44336); font-size: 16px;
          display: flex; align-items: center; justify-content: center;
        }
        .btn-add {
          width: 100%; padding: 9px;
          border: 1.5px dashed var(--divider-color, #ccc);
          border-radius: 8px; background: none;
          color: var(--primary-color); font-size: 14px; cursor: pointer;
          margin-top: 2px;
        }
        .scene-row { display: flex; gap: 8px; }
        .scene-row input { flex: 1; }
        .warn {
          background: var(--warning-color, #ff9800); color: #fff;
          border-radius: 8px; padding: 8px 12px; font-size: 13px;
          margin-bottom: 14px;
        }
      </style>

      <div class="editor">

        ${!cfg.storage_entity ? `<div class="warn">⚠ Selecteer eerst een Text helper hieronder.</div>` : ''}

        <div class="section">
          <label class="label">Text helper (opslag scenes)</label>
          <select id="sel-storage">
            <option value="">-- Kies een Text helper --</option>
            ${allInputTexts.map(({ id, name }) =>
              `<option value="${id}" ${id === cfg.storage_entity ? 'selected' : ''}>${name}</option>`
            ).join('')}
          </select>
          <p class="hint">
            Nog geen Text helper? Ga naar
            <strong>Instellingen → Helpers → + Nieuwe helper → Tekst</strong>,
            stel maximale lengte in op <strong>255</strong>.
          </p>
        </div>

        <div class="section">
          <label class="label">Lampen in deze ruimte</label>
          <div id="lights-list">
            ${lights.map((l, i) => `
              <div class="light-row">
                <select class="sel-light" data-idx="${i}">
                  <option value="">-- Kies lamp --</option>
                  ${allLights.map(({ id, name }) =>
                    `<option value="${id}" ${id === l.entity ? 'selected' : ''}>${name}</option>`
                  ).join('')}
                </select>
                <input class="inp-name" data-idx="${i}" type="text"
                       placeholder="Naam" value="${l.name || ''}">
                <button class="btn-del" data-idx="${i}">✕</button>
              </div>
            `).join('')}
          </div>
          <button class="btn-add" id="btn-add">+ Lamp toevoegen</button>
        </div>

        <div class="section">
          <label class="label">Scene namen (optioneel)</label>
          <div class="scene-row">
            <input type="text" class="inp-sname" data-key="scene1_name"
                   placeholder="Scene 1" value="${cfg.scene1_name || ''}">
            <input type="text" class="inp-sname" data-key="scene2_name"
                   placeholder="Scene 2" value="${cfg.scene2_name || ''}">
            <input type="text" class="inp-sname" data-key="scene3_name"
                   placeholder="Scene 3" value="${cfg.scene3_name || ''}">
          </div>
        </div>

      </div>`;

    this.querySelector('#sel-storage').addEventListener('change', e => {
      this._config.storage_entity = e.target.value || undefined;
      this._fire();
    });

    this.querySelectorAll('.sel-light').forEach(sel => {
      sel.addEventListener('change', e => {
        const i = parseInt(e.target.dataset.idx);
        this._config.lights[i] = { ...this._config.lights[i], entity: e.target.value };
        this._fire(); // geen _render()
      });
    });

    this.querySelectorAll('.inp-name').forEach(inp => {
      // input event: live updaten terwijl je typt
      inp.addEventListener('input', e => {
        const i = parseInt(e.target.dataset.idx);
        this._config.lights[i] = { ...this._config.lights[i], name: e.target.value };
        this._fire(); // geen _render()
      });
    });

    this.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', e => {
        const i = parseInt(e.currentTarget.dataset.idx);
        this._config.lights.splice(i, 1);
        this._fire(); // setConfig ziet lengte verandering → _render()
      });
    });

    this.querySelector('#btn-add').addEventListener('click', () => {
      this._config.lights.push({ entity: '', name: '' });
      this._fire(); // setConfig ziet lengte verandering → _render()
      setTimeout(() => {
        const rows = this.querySelectorAll('.light-row');
        rows[rows.length - 1]?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    });

    this.querySelectorAll('.inp-sname').forEach(inp => {
      inp.addEventListener('input', e => {
        const key = e.target.dataset.key;
        this._config[key] = e.target.value || undefined;
        this._fire(); // geen _render()
      });
    });
  }
}

customElements.define('ha-scene-card-editor', HaSceneCardEditor);


/* ════════════════════════════════════════════
   KAART  (zichtbaar voor de klant)
   ════════════════════════════════════════════ */

class HaSceneCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null; this._config = null;
    this._modal = null; this._scenes = null;
    this._editTab = 1; this._tempValues = null;
  }

  static getConfigElement() { return document.createElement('ha-scene-card-editor'); }
  static getStubConfig()    { return { storage_entity: '', lights: [] }; }
  getCardSize()              { return 1; }

  setConfig(config) {
    this._config = { lights: [], ...config };
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (!this._config) return;
    this._loadScenes();
    if (first) this._render();
  }

  disconnectedCallback() { this._closeModal(); }

  // ── Opslag ─────────────────────────────────────────────────

  _loadScenes() {
    const ent = this._config.storage_entity;
    const n   = this._config.lights.length;
    const def = { 1: Array(n).fill(100), 2: Array(n).fill(100), 3: Array(n).fill(100) };
    if (!this._hass || !ent) { if (!this._scenes) this._scenes = def; return; }
    const st = this._hass.states[ent];
    if (!st?.state || st.state === 'unknown' || st.state === '') { if (!this._scenes) this._scenes = def; return; }
    try {
      const p = JSON.parse(st.state);
      const out = {};
      for (let s = 1; s <= 3; s++) {
        const arr = Array.isArray(p[s]) ? p[s] : def[s];
        out[s] = Array.from({ length: n }, (_, i) =>
          typeof arr[i] === 'number' ? Math.max(0, Math.min(100, arr[i])) : 100);
      }
      this._scenes = out;
    } catch (_) { if (!this._scenes) this._scenes = def; }
  }

  _saveScenes(scenes) {
    const ent = this._config.storage_entity;
    if (!this._hass || !ent) return;
    this._hass.callService('input_text', 'set_value', {
      entity_id: ent, value: JSON.stringify(scenes),
    });
  }

  // ── Activeren ──────────────────────────────────────────────

  _activateScene(num, vals) {
    if (!this._hass) return;
    const v = vals || this._scenes?.[num] || [];
    this._config.lights.forEach((light, i) => {
      if (!light.entity) return;
      const pct = Math.round(v[i] ?? 0);
      this._hass.callService('light', pct === 0 ? 'turn_off' : 'turn_on', {
        entity_id: light.entity,
        ...(pct > 0 ? { brightness_pct: pct } : {}),
      });
    });
  }

  // Flash: klein rondje OM het icoon, niet het hele vlak
  _flashRipple(btn) {
    const r = btn.querySelector('.ripple');
    if (!r) return;
    r.classList.remove('flash');
    void r.offsetWidth;
    r.classList.add('flash');
    r.addEventListener('animationend', () => r.classList.remove('flash'), { once: true });
  }

  _addTapListener(el, action) {
    let t = 0;
    el.addEventListener('touchstart', e => { e.preventDefault(); t = Date.now(); action(); }, { passive: false });
    el.addEventListener('click', () => { if (Date.now() - t < 600) return; action(); });
  }

  // ── Render kaart ────────────────────────────────────────────

  _render() {
    if (!this._config) return;
    const cfg  = this._config;
    const icons = [cfg.scene1_icon || DEFAULTS.icons[0], cfg.scene2_icon || DEFAULTS.icons[1], cfg.scene3_icon || DEFAULTS.icons[2]];
    const names = [cfg.scene1_name || DEFAULTS.names[0], cfg.scene2_name || DEFAULTS.names[1], cfg.scene3_name || DEFAULTS.names[2]];

    // Niet geconfigureerd
    if (!cfg.storage_entity || !cfg.lights?.length) {
      this.shadowRoot.innerHTML = `
        <style>:host{display:block}ha-card{display:flex;align-items:center;justify-content:center;height:56px;gap:8px;padding:0 16px}ha-icon{--mdc-icon-size:18px;color:var(--secondary-text-color)}span{font-size:13px;color:var(--secondary-text-color)}</style>
        <ha-card><ha-icon icon="mdi:pencil-outline"></ha-icon><span>Configureer de kaart via het potlood-icoon</span></ha-card>`;
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          display: flex; align-items: center;
          padding: 0 4px; height: 56px;
          box-sizing: border-box; overflow: hidden;
          -webkit-tap-highlight-color: transparent;
        }
        /* Knop vult de ruimte — grote klikzone */
        .btn {
          flex: 1; height: 100%;
          border: none; background: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          -webkit-tap-highlight-color: transparent;
          outline: none; user-select: none; -webkit-user-select: none;
          touch-action: none;
        }
        /* Kleine cirkel om het icoon — dit is wat flitst */
        .ripple {
          width: 40px; height: 40px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: var(--secondary-text-color);
          --mdc-icon-size: 22px;
          flex-shrink: 0;
        }
        @keyframes rippleflash {
          0%   { background: color-mix(in srgb, var(--primary-color, #03a9f4) 28%, transparent); }
          100% { background: transparent; }
        }
        .ripple.flash { animation: rippleflash .35s ease-out; }
        .sep { width: 1px; height: 22px; background: var(--divider-color, #e0e0e0); flex-shrink: 0; }
      </style>
      <ha-card>
        ${[1,2,3].map(n => `
          <div class="btn" data-n="${n}" role="button" tabindex="-1" title="${names[n-1]}">
            <div class="ripple"><ha-icon icon="${icons[n-1]}"></ha-icon></div>
          </div>`).join('')}
        <div class="sep"></div>
        <div class="btn" id="ebtn" role="button" tabindex="-1" title="Scenes aanpassen">
          <div class="ripple"><ha-icon icon="mdi:pencil"></ha-icon></div>
        </div>
      </ha-card>`;

    this.shadowRoot.querySelectorAll('.btn[data-n]').forEach(btn => {
      this._addTapListener(btn, () => {
        this._flashRipple(btn);
        this._activateScene(parseInt(btn.dataset.n));
      });
    });
    this._addTapListener(this.shadowRoot.getElementById('ebtn'), () => this._openModal());
  }

  // ── Modal ───────────────────────────────────────────────────

  _openModal() {
    this._loadScenes();
    this._editTab    = 1;
    this._tempValues = { 1: [...(this._scenes[1]||[])], 2: [...(this._scenes[2]||[])], 3: [...(this._scenes[3]||[])] };
    this._buildModal();
  }

  _closeModal() { if (this._modal) { this._modal.remove(); this._modal = null; } }

  _buildModal() {
    this._closeModal();
    const lights = this._config.lights;
    const tab    = this._editTab;
    const vals   = this._tempValues[tab];
    const names  = [this._config.scene1_name||DEFAULTS.names[0], this._config.scene2_name||DEFAULTS.names[1], this._config.scene3_name||DEFAULTS.names[2]];

    const modal = document.createElement('div');
    Object.assign(modal.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,.52)', zIndex:'9999', display:'flex', alignItems:'flex-end', justifyContent:'center' });

    modal.innerHTML = `
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        #sheet{background:var(--card-background-color,#fafafa);border-radius:24px 24px 0 0;width:100%;max-width:520px;max-height:88vh;overflow-y:auto;font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif);padding-bottom:max(env(safe-area-inset-bottom,0px),20px)}
        .handle{width:40px;height:4px;border-radius:2px;background:var(--divider-color,#ddd);margin:14px auto 0}
        .hdr{padding:16px 20px 0}
        .hdr h3{font-size:18px;font-weight:600;color:var(--primary-text-color)}
        .tabs{display:flex;padding:14px 20px 0;border-bottom:1px solid var(--divider-color,#e0e0e0)}
        .tab{flex:1;text-align:center;padding:8px 4px;font-size:13px;font-weight:500;color:var(--secondary-text-color);cursor:pointer;touch-action:manipulation;border-bottom:2px solid transparent;transition:color .2s,border-color .2s}
        .tab.active{color:var(--primary-color);border-bottom-color:var(--primary-color)}
        .lights{padding:4px 20px}
        .lrow{padding:13px 0;border-bottom:1px solid var(--divider-color,#ebebeb)}
        .lrow:last-child{border-bottom:none}
        .lhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
        .linfo{display:flex;align-items:center;gap:8px}
        .licon{--mdc-icon-size:16px}
        .licon.on{color:var(--primary-color)}.licon.off{color:var(--disabled-text-color,#bbb)}
        .lname{font-size:14px;font-weight:500;color:var(--primary-text-color)}
        .lval{font-size:13px;font-weight:600;min-width:34px;text-align:right}
        .lval.on{color:var(--primary-color)}.lval.off{color:var(--disabled-text-color,#aaa)}
        .slider{-webkit-appearance:none;width:100%;height:6px;border-radius:3px;outline:none;cursor:pointer;touch-action:pan-x}
        .slider::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:var(--primary-color);box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer}
        .slider::-moz-range-thumb{width:22px;height:22px;border:none;border-radius:50%;background:var(--primary-color);box-shadow:0 1px 4px rgba(0,0,0,.25)}
        .footer{padding:14px 20px 0;display:flex;flex-direction:column;gap:10px}
        .btn-preview{padding:11px;border:1.5px solid var(--primary-color);border-radius:12px;background:none;font-size:14px;font-weight:500;color:var(--primary-color);cursor:pointer;touch-action:manipulation}
        .btn-row{display:flex;gap:10px}
        .btn-cancel{flex:1;padding:13px;border:1px solid var(--divider-color,#ddd);border-radius:12px;background:none;font-size:15px;font-weight:500;color:var(--secondary-text-color);cursor:pointer;touch-action:manipulation}
        .btn-save{flex:2;padding:13px;border:none;border-radius:12px;background:var(--primary-color);font-size:15px;font-weight:600;color:#fff;cursor:pointer;touch-action:manipulation}
        .btn-save:active{opacity:.85}
      </style>
      <div id="sheet">
        <div class="handle"></div>
        <div class="hdr"><h3>Scenes aanpassen</h3></div>
        <div class="tabs">
          ${[1,2,3].map(n=>`<div class="tab${n===tab?' active':''}" data-tab="${n}">${names[n-1]}</div>`).join('')}
        </div>
        <div class="lights">
          ${lights.map((l,i)=>{const v=Math.round(vals[i]??0);return`
            <div class="lrow">
              <div class="lhead">
                <div class="linfo">
                  <ha-icon class="licon ${v>0?'on':'off'}" icon="${v>0?'mdi:lightbulb':'mdi:lightbulb-off-outline'}"></ha-icon>
                  <span class="lname">${l.name||l.entity}</span>
                </div>
                <span class="lval ${v>0?'on':'off'}">${v>0?v+'%':'Uit'}</span>
              </div>
              <input class="slider" type="range" min="0" max="100" step="1" value="${v}" data-idx="${i}">
            </div>`;}).join('')}
        </div>
        <div class="footer">
          <button class="btn-preview" id="btn-preview">▶&nbsp; Voorbeeld bekijken</button>
          <div class="btn-row">
            <button class="btn-cancel" id="btn-cancel">Annuleren</button>
            <button class="btn-save" id="btn-save">Opslaan</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);
    this._modal = modal;

    modal.querySelectorAll('.slider').forEach(s => this._setSliderBg(s, +s.value));

    modal.addEventListener('click', e => { if (e.target === modal) this._closeModal(); });

    modal.querySelectorAll('.tab').forEach(t => {
      this._addTapListener(t, () => { this._editTab = parseInt(t.dataset.tab); this._buildModal(); });
    });

    modal.querySelectorAll('.slider').forEach(s => {
      s.addEventListener('input', () => {
        const i = parseInt(s.dataset.idx), v = Math.round(+s.value);
        this._tempValues[this._editTab][i] = v;
        this._setSliderBg(s, v);
        const row = s.closest('.lrow');
        const icon = row.querySelector('.licon'), val = row.querySelector('.lval');
        icon.setAttribute('icon', v>0?'mdi:lightbulb':'mdi:lightbulb-off-outline');
        icon.className = `licon ${v>0?'on':'off'}`;
        val.textContent = v>0?v+'%':'Uit'; val.className=`lval ${v>0?'on':'off'}`;
      });
    });

    this._addTapListener(modal.querySelector('#btn-preview'), () =>
      this._activateScene(this._editTab, this._tempValues[this._editTab]));
    this._addTapListener(modal.querySelector('#btn-cancel'), () => this._closeModal());
    this._addTapListener(modal.querySelector('#btn-save'), () => {
      this._scenes = { 1:[...this._tempValues[1]], 2:[...this._tempValues[2]], 3:[...this._tempValues[3]] };
      this._saveScenes(this._scenes);
      this._closeModal();
      this._activateScene(this._editTab);
    });
  }

  _setSliderBg(s, v) {
    const p = Math.round(v);
    s.style.background = `linear-gradient(to right,var(--primary-color) 0%,var(--primary-color) ${p}%,var(--secondary-background-color) ${p}%,var(--secondary-background-color) 100%)`;
  }
}

customElements.define('ha-scene-card', HaSceneCard);

window.customCards = window.customCards || [];
window.customCards.push({ type:'ha-scene-card', name:'HA Scene Card', description:'Scene-kaart met visuele editor. Scenes gedeeld tussen alle apparaten via HA Text helper.', preview:true });

console.info(`%c HA-SCENE-CARD %c v${VERSION} `,
  'background:#1565c0;color:#fff;padding:2px 5px;border-radius:3px 0 0 3px;font-weight:700',
  'background:#e3f2fd;color:#1565c0;padding:2px 5px;border-radius:0 3px 3px 0;font-weight:700');
