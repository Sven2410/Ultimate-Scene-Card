/**
 * HA Scene Card — v4.0.0
 * - Admin configureert via GUI (HA entity picker)
 * - Klant past scenes + iconen aan via het potlood
 * - Alles opgeslagen in een HA Text helper (gedeeld tussen alle apparaten)
 */

const VERSION = '4.0.0';
const DEFAULT_ICONS = ['mdi:numeric-1-circle', 'mdi:numeric-2-circle', 'mdi:numeric-3-circle'];
const SCENE_NAMES   = ['Scene 1', 'Scene 2', 'Scene 3'];

/* ══════════════════════════════════════════════════
   ADMIN EDITOR
   ══════════════════════════════════════════════════ */

class HaSceneCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = { lights: [] };
    this._hass   = null;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) {
      this._render();
    } else {
      // Geef bestaande pickers de nieuwe hass mee zonder volledige re-render
      this.querySelectorAll('ha-entity-picker').forEach(p => { p.hass = hass; });
    }
  }

  setConfig(config) {
    const prevLen = this._config?.lights?.length ?? -1;
    this._config  = { lights: [], ...config };
    if (!Array.isArray(this._config.lights)) this._config.lights = [];
    // Alleen opnieuw renderen bij structuurwijziging (lamp toevoegen/verwijderen)
    if (prevLen === -1 || prevLen !== this._config.lights.length) this._render();
  }

  _fire() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config } },
      bubbles: true, composed: true,
    }));
  }

  // Maak een ha-entity-picker en stop hem in een container-element.
  // Na een pagina-herlaad is ha-entity-picker soms nog niet geregistreerd
  // door HA's lazy loading. Wacht dan tot hij beschikbaar is.
  _makePicker(container, value, domains, onChange) {
    const create = () => {
      const picker = document.createElement('ha-entity-picker');
      picker.hass            = this._hass;
      picker.value           = value || '';
      picker.includeDomains  = domains;
      picker.allowCustomEntity = false;
      picker.style.cssText   = 'display:block;width:100%';
      picker.addEventListener('value-changed', e => onChange(e.detail.value));
      container.innerHTML = '';
      container.appendChild(picker);
    };

    if (customElements.get('ha-entity-picker')) {
      // Component al beschikbaar (normaal geval tijdens sessie)
      create();
    } else {
      // Na pagina-herlaad: toon tijdelijke placeholder en wacht op registratie
      container.innerHTML = `<div style="height:48px;display:flex;align-items:center;padding:0 4px;font-size:13px;color:var(--secondary-text-color)">Laden…</div>`;
      customElements.whenDefined('ha-entity-picker').then(create);
    }
  }

  _render() {
    if (!this._hass) return;
    const cfg    = this._config;
    const lights = cfg.lights || [];

    this.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        .section { margin-bottom: 20px; }
        .label {
          display: block; font-size: 12px; font-weight: 500; letter-spacing: .06em;
          text-transform: uppercase; color: var(--secondary-text-color); margin-bottom: 6px;
        }
        .hint { font-size: 12px; color: var(--secondary-text-color); margin-top: 5px; line-height: 1.5; }
        .hint strong { color: var(--primary-text-color); }
        .light-row { display: grid; grid-template-columns: 1fr 120px 34px; gap: 6px; margin-bottom: 8px; align-items: center; }
        input[type=text] {
          width: 100%; padding: 8px 10px;
          border: 1px solid var(--divider-color, #ddd); border-radius: 8px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color); font-size: 14px;
        }
        input[type=text]:focus { outline: none; border-color: var(--primary-color); }
        .btn-del {
          width: 34px; height: 34px; border-radius: 8px;
          border: 1px solid var(--divider-color, #ddd); background: none;
          cursor: pointer; color: var(--error-color, #f44336); font-size: 16px;
          display: flex; align-items: center; justify-content: center;
        }
        .btn-add {
          width: 100%; padding: 9px; margin-top: 4px;
          border: 1.5px dashed var(--divider-color, #ccc); border-radius: 8px;
          background: none; color: var(--primary-color); font-size: 14px; cursor: pointer;
        }
        .warn {
          background: var(--warning-color, #ff9800); color: #fff;
          border-radius: 8px; padding: 8px 12px; font-size: 13px; margin-bottom: 14px;
        }
      </style>

      ${!cfg.storage_entity ? `<div class="warn">⚠ Selecteer eerst een Text helper.</div>` : ''}

      <div class="section">
        <label class="label">Text helper (opslag scenes)</label>
        <div id="storage-slot"></div>
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
              <div id="light-slot-${i}"></div>
              <input class="inp-name" data-idx="${i}" type="text"
                     placeholder="Naam lamp" value="${l.name || ''}">
              <button class="btn-del" data-idx="${i}">✕</button>
            </div>
          `).join('')}
        </div>
        <button class="btn-add" id="btn-add">+ Lamp toevoegen</button>
      </div>
    `;

    // ── HA entity pickers invoegen ──

    // Text helper picker (input_text domein)
    this._makePicker(
      this.querySelector('#storage-slot'),
      cfg.storage_entity,
      ['input_text'],
      val => { this._config.storage_entity = val || undefined; this._fire(); }
    );

    // Light pickers
    lights.forEach((l, i) => {
      this._makePicker(
        this.querySelector(`#light-slot-${i}`),
        l.entity,
        ['light'],
        val => { this._config.lights[i] = { ...this._config.lights[i], entity: val }; this._fire(); }
      );
    });

    // ── Overige events ──

    this.querySelectorAll('.inp-name').forEach(inp => {
      inp.addEventListener('input', e => {
        const i = parseInt(e.target.dataset.idx);
        this._config.lights[i] = { ...this._config.lights[i], name: e.target.value };
        this._fire();
      });
    });

    this.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', e => {
        this._config.lights.splice(parseInt(e.currentTarget.dataset.idx), 1);
        this._render(); this._fire();
      });
    });

    this.querySelector('#btn-add').addEventListener('click', () => {
      this._config.lights.push({ entity: '', name: '' });
      this._render(); this._fire();
      setTimeout(() => {
        const rows = this.querySelectorAll('.light-row');
        rows[rows.length - 1]?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    });
  }
}

customElements.define('ha-scene-card-editor', HaSceneCardEditor);


/* ══════════════════════════════════════════════════
   KAART (voor de klant)
   ══════════════════════════════════════════════════ */

class HaSceneCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null; this._config = null;
    this._modal = null; this._scenes = null;
    this._editTab = 1; this._tempValues = null;
    this._lastStorageState = undefined;
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

    // Herrender alleen als de opgeslagen scenedata veranderd is
    const ent      = this._config.storage_entity;
    const newState = ent ? (hass.states[ent]?.state ?? '') : '';
    const changed  = newState !== this._lastStorageState;
    this._lastStorageState = newState;

    this._loadScenes();
    if (first || changed) this._render();
  }

  disconnectedCallback() { this._closeModal(); }

  // ── Opslag ─────────────────────────────────────────────────

  _loadScenes() {
    const ent = this._config.storage_entity;
    const n   = this._config.lights.length;
    const def = {
      1: Array(n).fill(100), 2: Array(n).fill(100), 3: Array(n).fill(100),
      icons: [...DEFAULT_ICONS],
    };
    if (!this._hass || !ent) { if (!this._scenes) this._scenes = def; return; }
    const st = this._hass.states[ent];
    if (!st?.state || st.state === 'unknown' || st.state === '') { if (!this._scenes) this._scenes = def; return; }
    try {
      const p = JSON.parse(st.state);
      const out = { icons: Array.isArray(p.icons) ? p.icons : [...DEFAULT_ICONS] };
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

  // ── Scene activeren ─────────────────────────────────────────

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

  _flashRipple(btn) {
    const r = btn.querySelector('.ripple');
    if (!r) return;
    r.classList.remove('flash'); void r.offsetWidth;
    r.classList.add('flash');
    r.addEventListener('animationend', () => r.classList.remove('flash'), { once: true });
  }

  _addTapListener(el, action) {
    let t = 0;
    el.addEventListener('touchstart', e => { e.preventDefault(); t = Date.now(); action(); }, { passive: false });
    el.addEventListener('click', () => { if (Date.now() - t < 600) return; action(); });
  }

  // ── Kaart render ────────────────────────────────────────────

  _render() {
    if (!this._config) return;

    // Niet geconfigureerd
    if (!this._config.storage_entity || !this._config.lights?.length) {
      this.shadowRoot.innerHTML = `
        <style>:host{display:block}ha-card{display:flex;align-items:center;justify-content:center;height:56px;gap:8px;padding:0 16px}-icon{--mdc-icon-size:18px;color:var(--secondary-text-color)}span{font-size:13px;color:var(--secondary-text-color)}</style>
        <ha-card><ha-icon icon="mdi:pencil-outline"></ha-icon><span>Configureer de kaart via het potlood</span></ha-card>`;
      return;
    }

    const icons = this._scenes?.icons || DEFAULT_ICONS;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          display: flex; align-items: center;
          padding: 0 4px; height: 56px; box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }
        .btn {
          flex: 1; height: 100%; border: none; background: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          -webkit-tap-highlight-color: transparent; outline: none;
          user-select: none; -webkit-user-select: none; touch-action: none;
        }
        .ripple {
          width: 40px; height: 40px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: var(--secondary-text-color); --mdc-icon-size: 22px; flex-shrink: 0;
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
          <div class="btn" data-n="${n}" role="button" tabindex="-1" title="Scene ${n}">
            <div class="ripple"><ha-icon icon="${icons[n-1] || DEFAULT_ICONS[n-1]}"></ha-icon></div>
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

  // ── Klant-popup ─────────────────────────────────────────────

  _openModal() {
    this._loadScenes();
    this._editTab    = 1;
    this._tempValues = {
      1: [...(this._scenes[1] || [])],
      2: [...(this._scenes[2] || [])],
      3: [...(this._scenes[3] || [])],
      icons: [...(this._scenes.icons || DEFAULT_ICONS)],
    };
    this._buildModal();
  }

  _closeModal() { if (this._modal) { this._modal.remove(); this._modal = null; } }

  _buildModal() {
    this._closeModal();
    const lights = this._config.lights;
    const tab    = this._editTab;
    const vals   = this._tempValues[tab];
    const icons  = this._tempValues.icons;

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,.52)',
      zIndex: '9999', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    });

    modal.innerHTML = `
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        #sheet{background:var(--card-background-color,#fafafa);border-radius:24px 24px 0 0;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif);padding-bottom:max(env(safe-area-inset-bottom,0px),20px)}
        .handle{width:40px;height:4px;border-radius:2px;background:var(--divider-color,#ddd);margin:14px auto 0}
        .hdr{padding:14px 20px 0}
        .hdr h3{font-size:18px;font-weight:600;color:var(--primary-text-color)}
        .tabs{display:flex;padding:12px 20px 0;border-bottom:1px solid var(--divider-color,#e0e0e0)}
        .tab{flex:1;text-align:center;padding:8px 4px;font-size:13px;font-weight:500;color:var(--secondary-text-color);cursor:pointer;touch-action:manipulation;border-bottom:2px solid transparent;transition:color .2s,border-color .2s}
        .tab.active{color:var(--primary-color);border-bottom-color:var(--primary-color)}
        .icon-row{display:flex;align-items:center;gap:12px;padding:14px 20px 0}
        .icon-preview{width:40px;height:40px;border-radius:50%;background:var(--secondary-background-color);display:flex;align-items:center;justify-content:center;flex-shrink:0;--mdc-icon-size:22px;color:var(--primary-color)}
        .icon-label{font-size:13px;color:var(--secondary-text-color)}
        #icon-picker-slot{flex:1}
        .lights{padding:4px 20px}
        .lrow{padding:13px 0;border-bottom:1px solid var(--divider-color,#ebebeb)}
        .lrow:last-child{border-bottom:none}
        .lhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
        .linfo{display:flex;align-items:center;gap:8px}
        .licon{--mdc-icon-size:16px}.licon.on{color:var(--primary-color)}.licon.off{color:var(--disabled-text-color,#bbb)}
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
      </style>
      <div id="sheet">
        <div class="handle"></div>
        <div class="hdr"><h3>Scenes aanpassen</h3></div>

        <div class="tabs">
          ${[1,2,3].map(n =>
            `<div class="tab${n===tab?' active':''}" data-tab="${n}">${SCENE_NAMES[n-1]}</div>`
          ).join('')}
        </div>

        <!-- Icoon kiezen voor deze scene -->
        <div class="icon-row">
          <div class="icon-preview" id="icon-preview">
            <ha-icon icon="${icons[tab-1] || DEFAULT_ICONS[tab-1]}"></ha-icon>
          </div>
          <span class="icon-label">Icoon scene ${tab}</span>
          <div id="icon-picker-slot"></div>
        </div>

        <!-- Lamp sliders -->
        <div class="lights">
          ${lights.map((l,i) => {
            const v = Math.round(vals[i] ?? 0);
            return `
              <div class="lrow">
                <div class="lhead">
                  <div class="linfo">
                    <ha-icon class="licon ${v>0?'on':'off'}" icon="${v>0?'mdi:lightbulb':'mdi:lightbulb-off-outline'}"></ha-icon>
                    <span class="lname">${l.name||l.entity}</span>
                  </div>
                  <span class="lval ${v>0?'on':'off'}">${v>0?v+'%':'Uit'}</span>
                </div>
                <input class="slider" type="range" min="0" max="100" step="1" value="${v}" data-idx="${i}">
              </div>`;
          }).join('')}
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

    // ── HA icon picker invoegen ──
    const iconPickerSlot = modal.querySelector('#icon-picker-slot');
    const iconPicker = document.createElement('ha-icon-picker');
    iconPicker.hass  = this._hass;
    iconPicker.value = icons[tab - 1] || DEFAULT_ICONS[tab - 1];
    iconPicker.style.cssText = 'display:block;flex:1';
    iconPicker.addEventListener('value-changed', e => {
      const newIcon = e.detail.value;
      this._tempValues.icons[this._editTab - 1] = newIcon;
      // Preview bijwerken
      const preview = modal.querySelector('#icon-preview ha-icon');
      if (preview) preview.setAttribute('icon', newIcon || DEFAULT_ICONS[this._editTab - 1]);
    });
    iconPickerSlot.appendChild(iconPicker);

    // ── Slider achtergronden ──
    modal.querySelectorAll('.slider').forEach(s => this._setSliderBg(s, +s.value));

    // ── Events ──
    modal.addEventListener('click', e => { if (e.target === modal) this._closeModal(); });

    modal.querySelectorAll('.tab').forEach(t => {
      this._addTapListener(t, () => {
        this._editTab = parseInt(t.dataset.tab);
        this._buildModal();
      });
    });

    modal.querySelectorAll('.slider').forEach(s => {
      s.addEventListener('input', () => {
        const i = parseInt(s.dataset.idx), v = Math.round(+s.value);
        this._tempValues[this._editTab][i] = v;
        this._setSliderBg(s, v);
        const row  = s.closest('.lrow');
        const icon = row.querySelector('.licon'), val = row.querySelector('.lval');
        icon.setAttribute('icon', v>0?'mdi:lightbulb':'mdi:lightbulb-off-outline');
        icon.className = `licon ${v>0?'on':'off'}`;
        val.textContent = v>0?v+'%':'Uit'; val.className = `lval ${v>0?'on':'off'}`;
      });
    });

    this._addTapListener(modal.querySelector('#btn-preview'), () =>
      this._activateScene(this._editTab, this._tempValues[this._editTab]));

    this._addTapListener(modal.querySelector('#btn-cancel'), () => this._closeModal());

    this._addTapListener(modal.querySelector('#btn-save'), () => {
      this._scenes = {
        1: [...this._tempValues[1]],
        2: [...this._tempValues[2]],
        3: [...this._tempValues[3]],
        icons: [...this._tempValues.icons],
      };
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
window.customCards.push({
  type: 'ha-scene-card', name: 'HA Scene Card',
  description: 'Scene-kaart met visuele editor. Scenes + iconen gedeeld via HA Text helper.',
  preview: true,
});

console.info(`%c HA-SCENE-CARD %c v${VERSION} `,
  'background:#1565c0;color:#fff;padding:2px 5px;border-radius:3px 0 0 3px;font-weight:700',
  'background:#e3f2fd;color:#1565c0;padding:2px 5px;border-radius:0 3px 3px 0;font-weight:700');
