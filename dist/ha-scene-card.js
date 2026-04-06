/**
 * HA Scene Card — v1.3.0
 * Compacte Lovelace kaart voor scene-beheer per ruimte
 *
 * Configuratie:
 *   type: custom:ha-scene-card
 *   lights:
 *     - entity: light.woonkamer_plafond
 *       name: Plafond
 *     - entity: light.woonkamer_ledstrip
 *       name: Ledstrip
 *
 * Optioneel:
 *   scene1_icon: mdi:walk          (standaard: mdi:walk)
 *   scene2_icon: mdi:candle        (standaard: mdi:candle)
 *   scene3_icon: mdi:lightbulb-on  (standaard: mdi:lightbulb-on)
 *   scene1_name: Dag               (standaard: Scene 1)
 *   scene2_name: Avond             (standaard: Scene 2)
 *   scene3_name: Nacht             (standaard: Scene 3)
 */

const VERSION = '1.3.0';

const DEFAULTS = {
  icons: ['mdi:walk', 'mdi:candle', 'mdi:lightbulb-on'],
  names: ['Scene 1', 'Scene 2', 'Scene 3'],
};

class HaSceneCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass       = null;
    this._config     = null;
    this._modal      = null;
    this._editTab    = 1;
    this._tempValues = null;
    this._scenes     = null;
  }

  static getStubConfig() {
    return {
      lights: [
        { entity: 'light.voorbeeld_lamp_1', name: 'Plafond' },
        { entity: 'light.voorbeeld_lamp_2', name: 'Vloerlamp' },
        { entity: 'light.voorbeeld_lamp_3', name: 'Ledstrip' },
      ],
    };
  }

  getCardSize() { return 1; }

  setConfig(config) {
    if (!config.lights || !Array.isArray(config.lights) || config.lights.length === 0) {
      throw new Error('[ha-scene-card] Vereist: minimaal één lamp in de "lights" lijst.');
    }
    this._config = { ...config };
    this._loadScenes();
    this._render();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (this._config && first) this._render();
  }

  disconnectedCallback() {
    this._closeModal();
  }

  // ── Opslag ─────────────────────────────────────────────────

  get _storageKey() {
    const base = (this._config.lights[0]?.entity || 'light')
      .replace(/\./g, '_')
      .replace(/[^a-z0-9_]/gi, '');
    return `ha_scene_card_v1_${base}`;
  }

  _defaultScenes() {
    const n = this._config.lights.length;
    return { 1: Array(n).fill(100), 2: Array(n).fill(100), 3: Array(n).fill(100) };
  }

  _loadScenes() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const n    = this._config.lights.length;
        const defs = this._defaultScenes();
        this._scenes = {};
        for (let s = 1; s <= 3; s++) {
          const arr = Array.isArray(parsed[s]) ? parsed[s] : defs[s];
          this._scenes[s] = Array.from({ length: n }, (_, i) =>
            typeof arr[i] === 'number' ? Math.max(0, Math.min(100, arr[i])) : 100
          );
        }
        return;
      }
    } catch (_) {}
    this._scenes = this._defaultScenes();
  }

  _saveScenes() {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(this._scenes));
    } catch (_) {}
  }

  // ── Scene activeren ─────────────────────────────────────────

  _activateScene(num, values) {
    if (!this._hass) return;
    const vals = values || this._scenes[num];
    this._config.lights.forEach((light, i) => {
      const pct = Math.round(vals[i] ?? 0);
      if (pct === 0) {
        this._hass.callService('light', 'turn_off', { entity_id: light.entity });
      } else {
        this._hass.callService('light', 'turn_on', {
          entity_id: light.entity,
          brightness_pct: pct,
        });
      }
    });
  }

  _flashBtn(btn) {
    btn.classList.remove('flash');
    void btn.offsetWidth;
    btn.classList.add('flash');
    btn.addEventListener('animationend', () => btn.classList.remove('flash'), { once: true });
  }

  // ── Tap-handler: betrouwbaar op zowel mobiel als desktop ────
  //
  // Het probleem op mobiel: na een tap "houdt" de browser het aangetikte
  // element vast als hover-doel. De volgende tap op een andere knop begint
  // met het unhover-en van de eerste knop, en het click-event op de tweede
  // knop wordt daardoor soms nooit afgeleverd.
  //
  // Oplossing: luister naar touchend (mobiel) en click (desktop) apart.
  // Bij touchend roepen we preventDefault() aan — dit stopt de browser
  // met het nabootsen van muisevents (mouseover, mouseenter, click) na
  // de touch, zodat de hover-vasthouding en ghost-clicks verdwijnen.
  // Een vlag voorkomt dat de gesimuleerde click daarna nog doorkomt.

  _addTapListener(el, handler) {
    let pendingTouch = false;

    el.addEventListener('touchend', (e) => {
      // Annuleer alle nagesimuleerde muisevents en ghost-click
      e.preventDefault();
      pendingTouch = true;
      // Vlag resetten na de volledige event-simulatie-cyclus (~500ms)
      setTimeout(() => { pendingTouch = false; }, 500);
      handler();
    }, { passive: false });

    el.addEventListener('click', () => {
      // Alleen uitvoeren als het geen touch-gegenereerde click is
      if (pendingTouch) return;
      handler();
    });
  }

  // ── Kaart renderen ──────────────────────────────────────────

  _render() {
    if (!this._config) return;
    const cfg = this._config;

    const icons = [
      cfg.scene1_icon || DEFAULTS.icons[0],
      cfg.scene2_icon || DEFAULTS.icons[1],
      cfg.scene3_icon || DEFAULTS.icons[2],
    ];
    const names = [
      cfg.scene1_name || DEFAULTS.names[0],
      cfg.scene2_name || DEFAULTS.names[1],
      cfg.scene3_name || DEFAULTS.names[2],
    ];

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        ha-card {
          display: flex;
          align-items: center;
          padding: 10px 4px;
          height: 56px;
          box-sizing: border-box;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent;
        }

        .btn {
          flex: 1;
          height: 36px;
          border: none;
          background: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          color: var(--secondary-text-color);
          --mdc-icon-size: 22px;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          outline: none;
          user-select: none;
          -webkit-user-select: none;
        }

        @keyframes btnflash {
          0%   { background: color-mix(in srgb, var(--primary-color, #03a9f4) 25%, transparent); }
          60%  { background: color-mix(in srgb, var(--primary-color, #03a9f4) 15%, transparent); }
          100% { background: transparent; }
        }

        .btn.flash {
          animation: btnflash 0.4s ease-out;
        }

        .sep {
          width: 1px;
          height: 22px;
          background: var(--divider-color, #e0e0e0);
          flex-shrink: 0;
        }
      </style>

      <ha-card>
        ${[1, 2, 3].map(n => `
          <button class="btn" data-n="${n}" title="${names[n - 1]}">
            <ha-icon icon="${icons[n - 1]}"></ha-icon>
          </button>
        `).join('')}
        <div class="sep"></div>
        <button class="btn" id="ebtn" title="Scenes aanpassen">
          <ha-icon icon="mdi:pencil"></ha-icon>
        </button>
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll('.btn[data-n]').forEach(btn => {
      this._addTapListener(btn, () => {
        this._flashBtn(btn);
        this._activateScene(parseInt(btn.dataset.n));
      });
    });

    this._addTapListener(
      this.shadowRoot.getElementById('ebtn'),
      () => this._openModal()
    );
  }

  // ── Modal ───────────────────────────────────────────────────

  _openModal() {
    this._editTab = 1;
    this._tempValues = {
      1: [...this._scenes[1]],
      2: [...this._scenes[2]],
      3: [...this._scenes[3]],
    };
    this._buildModal();
  }

  _closeModal() {
    if (this._modal) { this._modal.remove(); this._modal = null; }
  }

  _buildModal() {
    this._closeModal();

    const lights     = this._config.lights;
    const tab        = this._editTab;
    const vals       = this._tempValues[tab];
    const cfg        = this._config;
    const sceneNames = [
      cfg.scene1_name || DEFAULTS.names[0],
      cfg.scene2_name || DEFAULTS.names[1],
      cfg.scene3_name || DEFAULTS.names[2],
    ];

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,.52)',
      zIndex: '9999',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
    });

    const slidersHTML = lights.map((light, i) => {
      const v = Math.round(vals[i] ?? 0);
      return `
        <div class="lrow">
          <div class="lhead">
            <div class="linfo">
              <ha-icon class="licon ${v > 0 ? 'on' : 'off'}"
                       icon="${v > 0 ? 'mdi:lightbulb' : 'mdi:lightbulb-off-outline'}"></ha-icon>
              <span class="lname">${light.name || light.entity}</span>
            </div>
            <span class="lval ${v > 0 ? 'on' : 'off'}">${v > 0 ? v + '%' : 'Uit'}</span>
          </div>
          <input class="slider" type="range" min="0" max="100" step="1"
                 value="${v}" data-idx="${i}">
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        #sheet {
          background: var(--card-background-color, #fafafa);
          border-radius: 24px 24px 0 0;
          width: 100%; max-width: 520px;
          max-height: 88vh; overflow-y: auto;
          font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
          padding-bottom: max(env(safe-area-inset-bottom, 0px), 20px);
        }
        .handle {
          width: 40px; height: 4px; border-radius: 2px;
          background: var(--divider-color, #ddd);
          margin: 14px auto 0;
        }
        .hdr { padding: 16px 20px 0; }
        .hdr h3 { font-size: 18px; font-weight: 600; color: var(--primary-text-color); }
        .tabs {
          display: flex; padding: 14px 20px 0;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        .tab {
          flex: 1; text-align: center; padding: 8px 4px;
          font-size: 13px; font-weight: 500;
          color: var(--secondary-text-color); cursor: pointer;
          touch-action: manipulation;
          border-bottom: 2px solid transparent;
          transition: color .2s, border-color .2s;
        }
        .tab.active { color: var(--primary-color); border-bottom-color: var(--primary-color); }
        .lights { padding: 4px 20px; }
        .lrow { padding: 13px 0; border-bottom: 1px solid var(--divider-color, #ebebeb); }
        .lrow:last-child { border-bottom: none; }
        .lhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .linfo { display: flex; align-items: center; gap: 8px; }
        .licon { --mdc-icon-size: 16px; }
        .licon.on  { color: var(--primary-color); }
        .licon.off { color: var(--disabled-text-color, #bbb); }
        .lname { font-size: 14px; font-weight: 500; color: var(--primary-text-color); }
        .lval { font-size: 13px; font-weight: 600; min-width: 34px; text-align: right; }
        .lval.on  { color: var(--primary-color); }
        .lval.off { color: var(--disabled-text-color, #aaa); }
        .slider {
          -webkit-appearance: none;
          width: 100%; height: 6px; border-radius: 3px;
          outline: none; cursor: pointer; touch-action: pan-x;
        }
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 22px; height: 22px; border-radius: 50%;
          background: var(--primary-color);
          box-shadow: 0 1px 4px rgba(0,0,0,.25); cursor: pointer;
        }
        .slider::-moz-range-thumb {
          width: 22px; height: 22px; border: none; border-radius: 50%;
          background: var(--primary-color);
          box-shadow: 0 1px 4px rgba(0,0,0,.25); cursor: pointer;
        }
        .footer { padding: 14px 20px 0; display: flex; flex-direction: column; gap: 10px; }
        .btn-preview {
          padding: 11px; border: 1.5px solid var(--primary-color);
          border-radius: 12px; background: none;
          font-size: 14px; font-weight: 500; color: var(--primary-color);
          cursor: pointer; touch-action: manipulation;
        }
        .btn-row { display: flex; gap: 10px; }
        .btn-cancel {
          flex: 1; padding: 13px;
          border: 1px solid var(--divider-color, #ddd); border-radius: 12px;
          background: none; font-size: 15px; font-weight: 500;
          color: var(--secondary-text-color); cursor: pointer;
          touch-action: manipulation;
        }
        .btn-save {
          flex: 2; padding: 13px; border: none; border-radius: 12px;
          background: var(--primary-color); font-size: 15px; font-weight: 600;
          color: #fff; cursor: pointer; touch-action: manipulation;
        }
        .btn-save:active { opacity: .85; }
      </style>

      <div id="sheet">
        <div class="handle"></div>
        <div class="hdr"><h3>Scenes aanpassen</h3></div>
        <div class="tabs">
          ${[1, 2, 3].map(n =>
            `<div class="tab${n === tab ? ' active' : ''}" data-tab="${n}">${sceneNames[n - 1]}</div>`
          ).join('')}
        </div>
        <div class="lights">${slidersHTML}</div>
        <div class="footer">
          <button class="btn-preview" id="btn-preview">▶&nbsp; Voorbeeld bekijken</button>
          <div class="btn-row">
            <button class="btn-cancel" id="btn-cancel">Annuleren</button>
            <button class="btn-save"   id="btn-save">Opslaan</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this._modal = modal;

    modal.querySelectorAll('.slider').forEach(s => this._setSliderBg(s, parseFloat(s.value)));

    // Klik buiten sheet sluit modal
    this._addTapListener(modal, (e) => { if (e && e.target === modal) this._closeModal(); });
    modal.addEventListener('click', e => { if (e.target === modal) this._closeModal(); });

    modal.querySelectorAll('.tab').forEach(t => {
      this._addTapListener(t, () => {
        this._editTab = parseInt(t.dataset.tab);
        this._buildModal();
      });
    });

    modal.querySelectorAll('.slider').forEach(slider => {
      slider.addEventListener('input', () => {
        const i = parseInt(slider.dataset.idx);
        const v = Math.round(parseFloat(slider.value));
        this._tempValues[this._editTab][i] = v;
        this._setSliderBg(slider, v);
        const row  = slider.closest('.lrow');
        const icon = row.querySelector('.licon');
        const val  = row.querySelector('.lval');
        if (v === 0) {
          icon.setAttribute('icon', 'mdi:lightbulb-off-outline');
          icon.className = 'licon off';
          val.textContent = 'Uit';
          val.className = 'lval off';
        } else {
          icon.setAttribute('icon', 'mdi:lightbulb');
          icon.className = 'licon on';
          val.textContent = v + '%';
          val.className = 'lval on';
        }
      });
    });

    this._addTapListener(modal.querySelector('#btn-preview'), () => {
      this._activateScene(this._editTab, this._tempValues[this._editTab]);
    });

    this._addTapListener(modal.querySelector('#btn-cancel'), () => this._closeModal());

    this._addTapListener(modal.querySelector('#btn-save'), () => {
      this._scenes = {
        1: [...this._tempValues[1]],
        2: [...this._tempValues[2]],
        3: [...this._tempValues[3]],
      };
      this._saveScenes();
      this._closeModal();
      this._activateScene(this._editTab);
    });
  }

  _setSliderBg(slider, v) {
    const pct = Math.round(v);
    slider.style.background =
      `linear-gradient(to right,` +
      `var(--primary-color) 0%, var(--primary-color) ${pct}%,` +
      `var(--secondary-background-color) ${pct}%, var(--secondary-background-color) 100%)`;
  }
}

customElements.define('ha-scene-card', HaSceneCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        'ha-scene-card',
  name:        'HA Scene Card',
  description: 'Compacte scene-kaart voor lichtbeheer per ruimte. Klant kan scenes zelf aanpassen.',
  preview:     true,
});

console.info(
  `%c HA-SCENE-CARD %c v${VERSION} `,
  'background:#1565c0;color:#fff;padding:2px 5px;border-radius:3px 0 0 3px;font-weight:700',
  'background:#e3f2fd;color:#1565c0;padding:2px 5px;border-radius:0 3px 3px 0;font-weight:700'
);
