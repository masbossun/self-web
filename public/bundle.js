
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if (typeof $$scope.dirty === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function add_resize_listener(element, fn) {
        if (getComputedStyle(element).position === 'static') {
            element.style.position = 'relative';
        }
        const object = document.createElement('object');
        object.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; height: 100%; width: 100%; overflow: hidden; pointer-events: none; z-index: -1;');
        object.setAttribute('aria-hidden', 'true');
        object.type = 'text/html';
        object.tabIndex = -1;
        let win;
        object.onload = () => {
            win = object.contentDocument.defaultView;
            win.addEventListener('resize', fn);
        };
        if (/Trident/.test(navigator.userAgent)) {
            element.appendChild(object);
            object.data = 'about:blank';
        }
        else {
            object.data = 'about:blank';
            element.appendChild(object);
        }
        return {
            cancel: () => {
                win && win.removeEventListener && win.removeEventListener('resize', fn);
                element.removeChild(object);
            }
        };
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    const seen_callbacks = new Set();
    function flush() {
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.18.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /*
    Adapted from https://github.com/mattdesl
    Distributed under MIT License https://github.com/mattdesl/eases/blob/master/LICENSE.md
    */
    function backInOut(t) {
        const s = 1.70158 * 1.525;
        if ((t *= 2) < 1)
            return 0.5 * (t * t * ((s + 1) * t - s));
        return 0.5 * ((t -= 2) * t * ((s + 1) * t + s) + 2);
    }
    function backIn(t) {
        const s = 1.70158;
        return t * t * ((s + 1) * t - s);
    }
    function backOut(t) {
        const s = 1.70158;
        return --t * t * ((s + 1) * t + s) + 1;
    }
    function bounceOut(t) {
        const a = 4.0 / 11.0;
        const b = 8.0 / 11.0;
        const c = 9.0 / 10.0;
        const ca = 4356.0 / 361.0;
        const cb = 35442.0 / 1805.0;
        const cc = 16061.0 / 1805.0;
        const t2 = t * t;
        return t < a
            ? 7.5625 * t2
            : t < b
                ? 9.075 * t2 - 9.9 * t + 3.4
                : t < c
                    ? ca * t2 - cb * t + cc
                    : 10.8 * t * t - 20.52 * t + 10.72;
    }
    function bounceInOut(t) {
        return t < 0.5
            ? 0.5 * (1.0 - bounceOut(1.0 - t * 2.0))
            : 0.5 * bounceOut(t * 2.0 - 1.0) + 0.5;
    }
    function bounceIn(t) {
        return 1.0 - bounceOut(1.0 - t);
    }
    function circInOut(t) {
        if ((t *= 2) < 1)
            return -0.5 * (Math.sqrt(1 - t * t) - 1);
        return 0.5 * (Math.sqrt(1 - (t -= 2) * t) + 1);
    }
    function circIn(t) {
        return 1.0 - Math.sqrt(1.0 - t * t);
    }
    function circOut(t) {
        return Math.sqrt(1 - --t * t);
    }
    function cubicInOut(t) {
        return t < 0.5 ? 4.0 * t * t * t : 0.5 * Math.pow(2.0 * t - 2.0, 3.0) + 1.0;
    }
    function cubicIn(t) {
        return t * t * t;
    }
    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }
    function elasticInOut(t) {
        return t < 0.5
            ? 0.5 *
                Math.sin(((+13.0 * Math.PI) / 2) * 2.0 * t) *
                Math.pow(2.0, 10.0 * (2.0 * t - 1.0))
            : 0.5 *
                Math.sin(((-13.0 * Math.PI) / 2) * (2.0 * t - 1.0 + 1.0)) *
                Math.pow(2.0, -10.0 * (2.0 * t - 1.0)) +
                1.0;
    }
    function elasticIn(t) {
        return Math.sin((13.0 * t * Math.PI) / 2) * Math.pow(2.0, 10.0 * (t - 1.0));
    }
    function elasticOut(t) {
        return (Math.sin((-13.0 * (t + 1.0) * Math.PI) / 2) * Math.pow(2.0, -10.0 * t) + 1.0);
    }
    function expoInOut(t) {
        return t === 0.0 || t === 1.0
            ? t
            : t < 0.5
                ? +0.5 * Math.pow(2.0, 20.0 * t - 10.0)
                : -0.5 * Math.pow(2.0, 10.0 - t * 20.0) + 1.0;
    }
    function expoIn(t) {
        return t === 0.0 ? t : Math.pow(2.0, 10.0 * (t - 1.0));
    }
    function expoOut(t) {
        return t === 1.0 ? t : 1.0 - Math.pow(2.0, -10.0 * t);
    }
    function quadInOut(t) {
        t /= 0.5;
        if (t < 1)
            return 0.5 * t * t;
        t--;
        return -0.5 * (t * (t - 2) - 1);
    }
    function quadIn(t) {
        return t * t;
    }
    function quadOut(t) {
        return -t * (t - 2.0);
    }
    function quartInOut(t) {
        return t < 0.5
            ? +8.0 * Math.pow(t, 4.0)
            : -8.0 * Math.pow(t - 1.0, 4.0) + 1.0;
    }
    function quartIn(t) {
        return Math.pow(t, 4.0);
    }
    function quartOut(t) {
        return Math.pow(t - 1.0, 3.0) * (1.0 - t) + 1.0;
    }
    function quintInOut(t) {
        if ((t *= 2) < 1)
            return 0.5 * t * t * t * t * t;
        return 0.5 * ((t -= 2) * t * t * t * t + 2);
    }
    function quintIn(t) {
        return t * t * t * t * t;
    }
    function quintOut(t) {
        return --t * t * t * t * t + 1;
    }
    function sineInOut(t) {
        return -0.5 * (Math.cos(Math.PI * t) - 1);
    }
    function sineIn(t) {
        const v = Math.cos(t * Math.PI * 0.5);
        if (Math.abs(v) < 1e-14)
            return 1;
        else
            return 1 - v;
    }
    function sineOut(t) {
        return Math.sin((t * Math.PI) / 2);
    }

    var easings = /*#__PURE__*/Object.freeze({
        __proto__: null,
        backIn: backIn,
        backInOut: backInOut,
        backOut: backOut,
        bounceIn: bounceIn,
        bounceInOut: bounceInOut,
        bounceOut: bounceOut,
        circIn: circIn,
        circInOut: circInOut,
        circOut: circOut,
        cubicIn: cubicIn,
        cubicInOut: cubicInOut,
        cubicOut: cubicOut,
        elasticIn: elasticIn,
        elasticInOut: elasticInOut,
        elasticOut: elasticOut,
        expoIn: expoIn,
        expoInOut: expoInOut,
        expoOut: expoOut,
        quadIn: quadIn,
        quadInOut: quadInOut,
        quadOut: quadOut,
        quartIn: quartIn,
        quartInOut: quartInOut,
        quartOut: quartOut,
        quintIn: quintIn,
        quintInOut: quintInOut,
        quintOut: quintOut,
        sineIn: sineIn,
        sineInOut: sineInOut,
        sineOut: sineOut,
        linear: identity
    });

    var _ = {
      $(selector) {
        if (typeof selector === "string") {
          return document.querySelector(selector);
        }
        return selector;
      },
      extend(...args) {
        return Object.assign(...args);
      },
      cumulativeOffset(element) {
        let top = 0;
        let left = 0;

        do {
          top += element.offsetTop || 0;
          left += element.offsetLeft || 0;
          element = element.offsetParent;
        } while (element);

        return {
          top: top,
          left: left
        };
      },
      directScroll(element) {
        return element && element !== document && element !== document.body;
      },
      scrollTop(element, value) {
        let inSetter = value !== undefined;
        if (this.directScroll(element)) {
          return inSetter ? (element.scrollTop = value) : element.scrollTop;
        } else {
          return inSetter
            ? (document.documentElement.scrollTop = document.body.scrollTop = value)
            : window.pageYOffset ||
                document.documentElement.scrollTop ||
                document.body.scrollTop ||
                0;
        }
      },
      scrollLeft(element, value) {
        let inSetter = value !== undefined;
        if (this.directScroll(element)) {
          return inSetter ? (element.scrollLeft = value) : element.scrollLeft;
        } else {
          return inSetter
            ? (document.documentElement.scrollLeft = document.body.scrollLeft = value)
            : window.pageXOffset ||
                document.documentElement.scrollLeft ||
                document.body.scrollLeft ||
                0;
        }
      }
    };

    const defaultOptions = {
      container: "body",
      duration: 500,
      delay: 0,
      offset: 0,
      easing: "cubicInOut",
      onStart: noop,
      onDone: noop,
      onAborting: noop,
      scrollX: false,
      scrollY: true
    };

    const _scrollTo = options => {
      let {
        offset,
        duration,
        delay,
        easing,
        x=0,
        y=0,
        scrollX,
        scrollY,
        onStart,
        onDone,
        container,
        onAborting,
        element
      } = options;

      if (typeof easing === "string") {
        easing = easings[easing];
      }
      if (typeof offset === "function") {
        offset = offset();
      }

      var cumulativeOffsetContainer = _.cumulativeOffset(container);
      var cumulativeOffsetTarget = element
        ? _.cumulativeOffset(element)
        : { top: y, left: x };

      var initialX = _.scrollLeft(container);
      var initialY = _.scrollTop(container);

      var targetX =
        cumulativeOffsetTarget.left - cumulativeOffsetContainer.left + offset;
      var targetY =
        cumulativeOffsetTarget.top - cumulativeOffsetContainer.top + offset;

      var diffX = targetX - initialX;
    	var diffY = targetY - initialY;

      let scrolling = true;
      let started = false;
      let start_time = now() + delay;
      let end_time = start_time + duration;

      function scrollToTopLeft(element, top, left) {
        if (scrollX) _.scrollLeft(element, left);
        if (scrollY) _.scrollTop(element, top);
      }

      function start(delayStart) {
        if (!delayStart) {
          started = true;
          onStart(element, {x, y});
        }
      }

      function tick(progress) {
        scrollToTopLeft(
          container,
          initialY + diffY * progress,
          initialX + diffX * progress
        );
      }

      function stop() {
        scrolling = false;
      }

      loop(now => {
        if (!started && now >= start_time) {
          start(false);
        }

        if (started && now >= end_time) {
          tick(1);
          stop();
          onDone(element, {x, y});
        }

        if (!scrolling) {
          onAborting(element, {x, y});
          return false;
        }
        if (started) {
          const p = now - start_time;
          const t = 0 + 1 * easing(p / duration);
          tick(t);
        }

        return true;
      });

      start(delay);

      tick(0);

      return stop;
    };

    const proceedOptions = options => {
    	let opts = _.extend({}, defaultOptions, options);
      opts.container = _.$(opts.container);
      opts.element = _.$(opts.element);
      return opts;
    };

    const scrollTo$1 = options => {
      return _scrollTo(proceedOptions(options));
    };

    const scrollToTop = options => {
      options = proceedOptions(options);

      return _scrollTo(
        _.extend(options, {
          element: null,
          y: 0
        })
      );
    };

    /* src/Tailwindcss.svelte generated by Svelte v3.18.0 */

    function create_fragment(ctx) {
    	const block = {
    		c: noop,
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class Tailwindcss extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tailwindcss",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* node_modules/svelte-feather-icons/src/icons/GithubIcon.svelte generated by Svelte v3.18.0 */

    const file = "node_modules/svelte-feather-icons/src/icons/GithubIcon.svelte";

    function create_fragment$1(ctx) {
    	let svg;
    	let path;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path = svg_element("path");
    			attr_dev(path, "d", "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22");
    			add_location(path, file, 0, 217, 217);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "stroke", "currentColor");
    			attr_dev(svg, "stroke-width", "2");
    			attr_dev(svg, "stroke-linecap", "round");
    			attr_dev(svg, "stroke-linejoin", "round");
    			attr_dev(svg, "class", "feather feather-github");
    			add_location(svg, file, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class GithubIcon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GithubIcon",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* node_modules/svelte-feather-icons/src/icons/InstagramIcon.svelte generated by Svelte v3.18.0 */

    const file$1 = "node_modules/svelte-feather-icons/src/icons/InstagramIcon.svelte";

    function create_fragment$2(ctx) {
    	let svg;
    	let rect;
    	let path;
    	let line;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			rect = svg_element("rect");
    			path = svg_element("path");
    			line = svg_element("line");
    			attr_dev(rect, "x", "2");
    			attr_dev(rect, "y", "2");
    			attr_dev(rect, "width", "20");
    			attr_dev(rect, "height", "20");
    			attr_dev(rect, "rx", "5");
    			attr_dev(rect, "ry", "5");
    			add_location(rect, file$1, 0, 220, 220);
    			attr_dev(path, "d", "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z");
    			add_location(path, file$1, 0, 282, 282);
    			attr_dev(line, "x1", "17.5");
    			attr_dev(line, "y1", "6.5");
    			attr_dev(line, "x2", "17.51");
    			attr_dev(line, "y2", "6.5");
    			add_location(line, file$1, 0, 347, 347);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "stroke", "currentColor");
    			attr_dev(svg, "stroke-width", "2");
    			attr_dev(svg, "stroke-linecap", "round");
    			attr_dev(svg, "stroke-linejoin", "round");
    			attr_dev(svg, "class", "feather feather-instagram");
    			add_location(svg, file$1, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, rect);
    			append_dev(svg, path);
    			append_dev(svg, line);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class InstagramIcon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "InstagramIcon",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* node_modules/svelte-feather-icons/src/icons/LinkedinIcon.svelte generated by Svelte v3.18.0 */

    const file$2 = "node_modules/svelte-feather-icons/src/icons/LinkedinIcon.svelte";

    function create_fragment$3(ctx) {
    	let svg;
    	let path;
    	let rect;
    	let circle;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path = svg_element("path");
    			rect = svg_element("rect");
    			circle = svg_element("circle");
    			attr_dev(path, "d", "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z");
    			add_location(path, file$2, 0, 219, 219);
    			attr_dev(rect, "x", "2");
    			attr_dev(rect, "y", "9");
    			attr_dev(rect, "width", "4");
    			attr_dev(rect, "height", "12");
    			add_location(rect, file$2, 0, 315, 315);
    			attr_dev(circle, "cx", "4");
    			attr_dev(circle, "cy", "4");
    			attr_dev(circle, "r", "2");
    			add_location(circle, file$2, 0, 362, 362);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "stroke", "currentColor");
    			attr_dev(svg, "stroke-width", "2");
    			attr_dev(svg, "stroke-linecap", "round");
    			attr_dev(svg, "stroke-linejoin", "round");
    			attr_dev(svg, "class", "feather feather-linkedin");
    			add_location(svg, file$2, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path);
    			append_dev(svg, rect);
    			append_dev(svg, circle);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class LinkedinIcon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "LinkedinIcon",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* node_modules/svelte-feather-icons/src/icons/MenuIcon.svelte generated by Svelte v3.18.0 */

    const file$3 = "node_modules/svelte-feather-icons/src/icons/MenuIcon.svelte";

    function create_fragment$4(ctx) {
    	let svg;
    	let line0;
    	let line1;
    	let line2;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			line0 = svg_element("line");
    			line1 = svg_element("line");
    			line2 = svg_element("line");
    			attr_dev(line0, "x1", "3");
    			attr_dev(line0, "y1", "12");
    			attr_dev(line0, "x2", "21");
    			attr_dev(line0, "y2", "12");
    			add_location(line0, file$3, 0, 215, 215);
    			attr_dev(line1, "x1", "3");
    			attr_dev(line1, "y1", "6");
    			attr_dev(line1, "x2", "21");
    			attr_dev(line1, "y2", "6");
    			add_location(line1, file$3, 0, 259, 259);
    			attr_dev(line2, "x1", "3");
    			attr_dev(line2, "y1", "18");
    			attr_dev(line2, "x2", "21");
    			attr_dev(line2, "y2", "18");
    			add_location(line2, file$3, 0, 301, 301);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "stroke", "currentColor");
    			attr_dev(svg, "stroke-width", "2");
    			attr_dev(svg, "stroke-linecap", "round");
    			attr_dev(svg, "stroke-linejoin", "round");
    			attr_dev(svg, "class", "feather feather-menu");
    			add_location(svg, file$3, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, line0);
    			append_dev(svg, line1);
    			append_dev(svg, line2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class MenuIcon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MenuIcon",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* node_modules/svelte-feather-icons/src/icons/TwitterIcon.svelte generated by Svelte v3.18.0 */

    const file$4 = "node_modules/svelte-feather-icons/src/icons/TwitterIcon.svelte";

    function create_fragment$5(ctx) {
    	let svg;
    	let path;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path = svg_element("path");
    			attr_dev(path, "d", "M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z");
    			add_location(path, file$4, 0, 218, 218);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "stroke", "currentColor");
    			attr_dev(svg, "stroke-width", "2");
    			attr_dev(svg, "stroke-linecap", "round");
    			attr_dev(svg, "stroke-linejoin", "round");
    			attr_dev(svg, "class", "feather feather-twitter");
    			add_location(svg, file$4, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class TwitterIcon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TwitterIcon",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* node_modules/svelte-feather-icons/src/icons/XIcon.svelte generated by Svelte v3.18.0 */

    const file$5 = "node_modules/svelte-feather-icons/src/icons/XIcon.svelte";

    function create_fragment$6(ctx) {
    	let svg;
    	let line0;
    	let line1;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			line0 = svg_element("line");
    			line1 = svg_element("line");
    			attr_dev(line0, "x1", "18");
    			attr_dev(line0, "y1", "6");
    			attr_dev(line0, "x2", "6");
    			attr_dev(line0, "y2", "18");
    			add_location(line0, file$5, 0, 212, 212);
    			attr_dev(line1, "x1", "6");
    			attr_dev(line1, "y1", "6");
    			attr_dev(line1, "x2", "18");
    			attr_dev(line1, "y2", "18");
    			add_location(line1, file$5, 0, 255, 255);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "stroke", "currentColor");
    			attr_dev(svg, "stroke-width", "2");
    			attr_dev(svg, "stroke-linecap", "round");
    			attr_dev(svg, "stroke-linejoin", "round");
    			attr_dev(svg, "class", "feather feather-x");
    			add_location(svg, file$5, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, line0);
    			append_dev(svg, line1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class XIcon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "XIcon",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/components/common/Logo.svelte generated by Svelte v3.18.0 */
    const file$6 = "src/components/common/Logo.svelte";

    function create_fragment$7(ctx) {
    	let t0;
    	let a;
    	let div;
    	let span;
    	let a_class_value;
    	let current;
    	const tailwindcss = new Tailwindcss({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(tailwindcss.$$.fragment);
    			t0 = space();
    			a = element("a");
    			div = element("div");
    			span = element("span");
    			span.textContent = "masbossun";
    			attr_dev(span, "class", "font-sans font-bold text-white text-xl");
    			add_location(span, file$6, 13, 4, 403);
    			attr_dev(div, "class", "bg-black py-3 px-5");
    			add_location(div, file$6, 12, 2, 366);
    			attr_dev(a, "href", "#");
    			attr_dev(a, "class", a_class_value = "cursor-pointer " + /*classes*/ ctx[0]);
    			add_location(a, file$6, 11, 0, 318);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(tailwindcss, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, a, anchor);
    			append_dev(a, div);
    			append_dev(div, span);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*classes*/ 1 && a_class_value !== (a_class_value = "cursor-pointer " + /*classes*/ ctx[0])) {
    				attr_dev(a, "class", a_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tailwindcss.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tailwindcss.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tailwindcss, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { classes = "" } = $$props;
    	const writable_props = ["classes"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Logo> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("classes" in $$props) $$invalidate(0, classes = $$props.classes);
    	};

    	$$self.$capture_state = () => {
    		return { classes };
    	};

    	$$self.$inject_state = $$props => {
    		if ("classes" in $$props) $$invalidate(0, classes = $$props.classes);
    	};

    	return [classes];
    }

    class Logo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment$7, safe_not_equal, { classes: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Logo",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get classes() {
    		throw new Error("<Logo>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set classes(value) {
    		throw new Error("<Logo>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/navbar/Navlink.svelte generated by Svelte v3.18.0 */
    const file$7 = "src/components/navbar/Navlink.svelte";

    function create_fragment$8(ctx) {
    	let t0;
    	let a;
    	let div;
    	let span;
    	let t1;
    	let div_class_value;
    	let current;
    	let dispose;
    	const tailwindcss = new Tailwindcss({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(tailwindcss.$$.fragment);
    			t0 = space();
    			a = element("a");
    			div = element("div");
    			span = element("span");
    			t1 = text(/*text*/ ctx[1]);
    			attr_dev(span, "class", "font-sans font-medium text-black text-base");
    			add_location(span, file$7, 33, 4, 1231);
    			attr_dev(div, "class", div_class_value = "bg-white py-2 px-4 " + (/*hasShadow*/ ctx[2] && "shadow-button") + " svelte-ddxlmx");
    			add_location(div, file$7, 32, 2, 1163);
    			attr_dev(a, "href", /*link*/ ctx[0]);
    			attr_dev(a, "class", "cursor-pointer px-4");
    			add_location(a, file$7, 31, 0, 1090);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(tailwindcss, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, a, anchor);
    			append_dev(a, div);
    			append_dev(div, span);
    			append_dev(span, t1);
    			current = true;
    			dispose = listen_dev(a, "click", /*scrollToElement*/ ctx[3], false, false, false);
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*text*/ 2) set_data_dev(t1, /*text*/ ctx[1]);

    			if (!current || dirty & /*hasShadow*/ 4 && div_class_value !== (div_class_value = "bg-white py-2 px-4 " + (/*hasShadow*/ ctx[2] && "shadow-button") + " svelte-ddxlmx")) {
    				attr_dev(div, "class", div_class_value);
    			}

    			if (!current || dirty & /*link*/ 1) {
    				attr_dev(a, "href", /*link*/ ctx[0]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tailwindcss.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tailwindcss.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tailwindcss, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(a);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { link = "#" } = $$props;
    	let { text } = $$props;
    	let { hasShadow = false } = $$props;
    	let { scrollTo = "" } = $$props;
    	const dispatch = createEventDispatcher();

    	function onClick() {
    		dispatch("click");
    	}

    	function scrollToElement() {
    		scrollTo$1({ element: scrollTo });
    		onClick();
    	}

    	const writable_props = ["link", "text", "hasShadow", "scrollTo"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Navlink> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("link" in $$props) $$invalidate(0, link = $$props.link);
    		if ("text" in $$props) $$invalidate(1, text = $$props.text);
    		if ("hasShadow" in $$props) $$invalidate(2, hasShadow = $$props.hasShadow);
    		if ("scrollTo" in $$props) $$invalidate(4, scrollTo = $$props.scrollTo);
    	};

    	$$self.$capture_state = () => {
    		return { link, text, hasShadow, scrollTo };
    	};

    	$$self.$inject_state = $$props => {
    		if ("link" in $$props) $$invalidate(0, link = $$props.link);
    		if ("text" in $$props) $$invalidate(1, text = $$props.text);
    		if ("hasShadow" in $$props) $$invalidate(2, hasShadow = $$props.hasShadow);
    		if ("scrollTo" in $$props) $$invalidate(4, scrollTo = $$props.scrollTo);
    	};

    	return [link, text, hasShadow, scrollToElement, scrollTo];
    }

    class Navlink extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$8, safe_not_equal, {
    			link: 0,
    			text: 1,
    			hasShadow: 2,
    			scrollTo: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Navlink",
    			options,
    			id: create_fragment$8.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*text*/ ctx[1] === undefined && !("text" in props)) {
    			console.warn("<Navlink> was created without expected prop 'text'");
    		}
    	}

    	get link() {
    		throw new Error("<Navlink>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set link(value) {
    		throw new Error("<Navlink>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get text() {
    		throw new Error("<Navlink>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set text(value) {
    		throw new Error("<Navlink>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get hasShadow() {
    		throw new Error("<Navlink>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set hasShadow(value) {
    		throw new Error("<Navlink>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get scrollTo() {
    		throw new Error("<Navlink>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set scrollTo(value) {
    		throw new Error("<Navlink>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/navbar/Navbar.svelte generated by Svelte v3.18.0 */
    const file$8 = "src/components/navbar/Navbar.svelte";

    // (30:2) {#if isMenuOpen}
    function create_if_block(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let button;
    	let current;
    	let dispose;

    	const navlink0 = new Navlink({
    			props: { text: "bio", scrollTo: "#bio" },
    			$$inline: true
    		});

    	navlink0.$on("click", /*toggleMenu*/ ctx[2]);

    	const navlink1 = new Navlink({
    			props: { text: "projects", scrollTo: "#projects" },
    			$$inline: true
    		});

    	navlink1.$on("click", /*toggleMenu*/ ctx[2]);

    	const navlink2 = new Navlink({
    			props: {
    				text: "blog",
    				link: "https://masbossun.web.id/blog/"
    			},
    			$$inline: true
    		});

    	const navlink3 = new Navlink({
    			props: {
    				text: "contact me",
    				scrollTo: "#footer",
    				hasShadow: true
    			},
    			$$inline: true
    		});

    	navlink3.$on("click", /*toggleMenu*/ ctx[2]);
    	const xicon = new XIcon({ $$inline: true });

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			create_component(navlink0.$$.fragment);
    			t0 = space();
    			create_component(navlink1.$$.fragment);
    			t1 = space();
    			create_component(navlink2.$$.fragment);
    			t2 = space();
    			create_component(navlink3.$$.fragment);
    			t3 = space();
    			button = element("button");
    			create_component(xicon.$$.fragment);
    			attr_dev(div0, "class", "flex flex-col justify-around items-center h-full py-64");
    			add_location(div0, file$8, 31, 6, 1081);
    			attr_dev(button, "class", "fixed bottom-0 right-0 z-50 mr-16 mb-16 w-12");
    			add_location(button, file$8, 40, 6, 1527);
    			attr_dev(div1, "class", "fixed inset-0 bg-white z-40");
    			add_location(div1, file$8, 30, 4, 1033);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			mount_component(navlink0, div0, null);
    			append_dev(div0, t0);
    			mount_component(navlink1, div0, null);
    			append_dev(div0, t1);
    			mount_component(navlink2, div0, null);
    			append_dev(div0, t2);
    			mount_component(navlink3, div0, null);
    			append_dev(div1, t3);
    			append_dev(div1, button);
    			mount_component(xicon, button, null);
    			current = true;
    			dispose = listen_dev(button, "click", /*toggleMenu*/ ctx[2], false, false, false);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navlink0.$$.fragment, local);
    			transition_in(navlink1.$$.fragment, local);
    			transition_in(navlink2.$$.fragment, local);
    			transition_in(navlink3.$$.fragment, local);
    			transition_in(xicon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navlink0.$$.fragment, local);
    			transition_out(navlink1.$$.fragment, local);
    			transition_out(navlink2.$$.fragment, local);
    			transition_out(navlink3.$$.fragment, local);
    			transition_out(xicon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(navlink0);
    			destroy_component(navlink1);
    			destroy_component(navlink2);
    			destroy_component(navlink3);
    			destroy_component(xicon);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(30:2) {#if isMenuOpen}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let t0;
    	let div2;
    	let t1;
    	let div0;
    	let t2;
    	let t3;
    	let div1;
    	let t4;
    	let t5;
    	let t6;
    	let div2_class_value;
    	let current;
    	let dispose;
    	const tailwindcss = new Tailwindcss({ $$inline: true });
    	const logo = new Logo({ $$inline: true });
    	const menuicon = new MenuIcon({ $$inline: true });
    	let if_block = /*isMenuOpen*/ ctx[1] && create_if_block(ctx);

    	const navlink0 = new Navlink({
    			props: { text: "bio", scrollTo: "#bio" },
    			$$inline: true
    		});

    	const navlink1 = new Navlink({
    			props: { text: "projects", scrollTo: "#projects" },
    			$$inline: true
    		});

    	const navlink2 = new Navlink({
    			props: {
    				text: "blog",
    				link: "https://masbossun.web.id/blog/"
    			},
    			$$inline: true
    		});

    	const navlink3 = new Navlink({
    			props: {
    				text: "contact me",
    				scrollTo: "#footer",
    				hasShadow: true
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(tailwindcss.$$.fragment);
    			t0 = space();
    			div2 = element("div");
    			create_component(logo.$$.fragment);
    			t1 = space();
    			div0 = element("div");
    			create_component(menuicon.$$.fragment);
    			t2 = space();
    			if (if_block) if_block.c();
    			t3 = space();
    			div1 = element("div");
    			create_component(navlink0.$$.fragment);
    			t4 = space();
    			create_component(navlink1.$$.fragment);
    			t5 = space();
    			create_component(navlink2.$$.fragment);
    			t6 = space();
    			create_component(navlink3.$$.fragment);
    			attr_dev(div0, "class", "flex md:hidden menu-icon cursor-pointer svelte-18inrea");
    			add_location(div0, file$8, 26, 2, 908);
    			attr_dev(div1, "class", "hidden md:flex");
    			add_location(div1, file$8, 47, 2, 1682);
    			attr_dev(div2, "class", div2_class_value = "flex justify-between items-center " + /*classes*/ ctx[0] + " svelte-18inrea");
    			add_location(div2, file$8, 24, 0, 837);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(tailwindcss, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div2, anchor);
    			mount_component(logo, div2, null);
    			append_dev(div2, t1);
    			append_dev(div2, div0);
    			mount_component(menuicon, div0, null);
    			append_dev(div2, t2);
    			if (if_block) if_block.m(div2, null);
    			append_dev(div2, t3);
    			append_dev(div2, div1);
    			mount_component(navlink0, div1, null);
    			append_dev(div1, t4);
    			mount_component(navlink1, div1, null);
    			append_dev(div1, t5);
    			mount_component(navlink2, div1, null);
    			append_dev(div1, t6);
    			mount_component(navlink3, div1, null);
    			current = true;
    			dispose = listen_dev(div0, "click", /*toggleMenu*/ ctx[2], false, false, false);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*isMenuOpen*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div2, t3);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty & /*classes*/ 1 && div2_class_value !== (div2_class_value = "flex justify-between items-center " + /*classes*/ ctx[0] + " svelte-18inrea")) {
    				attr_dev(div2, "class", div2_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tailwindcss.$$.fragment, local);
    			transition_in(logo.$$.fragment, local);
    			transition_in(menuicon.$$.fragment, local);
    			transition_in(if_block);
    			transition_in(navlink0.$$.fragment, local);
    			transition_in(navlink1.$$.fragment, local);
    			transition_in(navlink2.$$.fragment, local);
    			transition_in(navlink3.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tailwindcss.$$.fragment, local);
    			transition_out(logo.$$.fragment, local);
    			transition_out(menuicon.$$.fragment, local);
    			transition_out(if_block);
    			transition_out(navlink0.$$.fragment, local);
    			transition_out(navlink1.$$.fragment, local);
    			transition_out(navlink2.$$.fragment, local);
    			transition_out(navlink3.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tailwindcss, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div2);
    			destroy_component(logo);
    			destroy_component(menuicon);
    			if (if_block) if_block.d();
    			destroy_component(navlink0);
    			destroy_component(navlink1);
    			destroy_component(navlink2);
    			destroy_component(navlink3);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { classes = "" } = $$props;
    	let currentHref = window.location.href;
    	let isMenuOpen = false;

    	function toggleMenu() {
    		$$invalidate(1, isMenuOpen = !isMenuOpen);
    	}

    	const writable_props = ["classes"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Navbar> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("classes" in $$props) $$invalidate(0, classes = $$props.classes);
    	};

    	$$self.$capture_state = () => {
    		return { classes, currentHref, isMenuOpen };
    	};

    	$$self.$inject_state = $$props => {
    		if ("classes" in $$props) $$invalidate(0, classes = $$props.classes);
    		if ("currentHref" in $$props) currentHref = $$props.currentHref;
    		if ("isMenuOpen" in $$props) $$invalidate(1, isMenuOpen = $$props.isMenuOpen);
    	};

    	return [classes, isMenuOpen, toggleMenu];
    }

    class Navbar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$9, safe_not_equal, { classes: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Navbar",
    			options,
    			id: create_fragment$9.name
    		});
    	}

    	get classes() {
    		throw new Error("<Navbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set classes(value) {
    		throw new Error("<Navbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/common/Content.svelte generated by Svelte v3.18.0 */
    const file$9 = "src/components/common/Content.svelte";

    function create_fragment$a(ctx) {
    	let t;
    	let div;
    	let div_class_value;
    	let div_resize_listener;
    	let current;
    	const tailwindcss = new Tailwindcss({ $$inline: true });
    	const default_slot_template = /*$$slots*/ ctx[4].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

    	const block = {
    		c: function create() {
    			create_component(tailwindcss.$$.fragment);
    			t = space();
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "id", /*id*/ ctx[2]);
    			attr_dev(div, "class", div_class_value = "min-h-screen " + /*classes*/ ctx[1]);
    			add_render_callback(() => /*div_elementresize_handler*/ ctx[5].call(div));
    			add_location(div, file$9, 10, 0, 221);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(tailwindcss, target, anchor);
    			insert_dev(target, t, anchor);
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			div_resize_listener = add_resize_listener(div, /*div_elementresize_handler*/ ctx[5].bind(div));
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 8) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[3], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null));
    			}

    			if (!current || dirty & /*id*/ 4) {
    				attr_dev(div, "id", /*id*/ ctx[2]);
    			}

    			if (!current || dirty & /*classes*/ 2 && div_class_value !== (div_class_value = "min-h-screen " + /*classes*/ ctx[1])) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tailwindcss.$$.fragment, local);
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tailwindcss.$$.fragment, local);
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tailwindcss, detaching);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    			div_resize_listener.cancel();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { classes = "" } = $$props;
    	let { id = "" } = $$props;
    	let { clientHeight = 0 } = $$props;
    	const writable_props = ["classes", "id", "clientHeight"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Content> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;

    	function div_elementresize_handler() {
    		clientHeight = this.clientHeight;
    		$$invalidate(0, clientHeight);
    	}

    	$$self.$set = $$props => {
    		if ("classes" in $$props) $$invalidate(1, classes = $$props.classes);
    		if ("id" in $$props) $$invalidate(2, id = $$props.id);
    		if ("clientHeight" in $$props) $$invalidate(0, clientHeight = $$props.clientHeight);
    		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return { classes, id, clientHeight };
    	};

    	$$self.$inject_state = $$props => {
    		if ("classes" in $$props) $$invalidate(1, classes = $$props.classes);
    		if ("id" in $$props) $$invalidate(2, id = $$props.id);
    		if ("clientHeight" in $$props) $$invalidate(0, clientHeight = $$props.clientHeight);
    	};

    	return [clientHeight, classes, id, $$scope, $$slots, div_elementresize_handler];
    }

    class Content extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$a, safe_not_equal, { classes: 1, id: 2, clientHeight: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Content",
    			options,
    			id: create_fragment$a.name
    		});
    	}

    	get classes() {
    		throw new Error("<Content>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set classes(value) {
    		throw new Error("<Content>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Content>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Content>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get clientHeight() {
    		throw new Error("<Content>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set clientHeight(value) {
    		throw new Error("<Content>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/common/ProjectOverview.svelte generated by Svelte v3.18.0 */
    const file$a = "src/components/common/ProjectOverview.svelte";

    function create_fragment$b(ctx) {
    	let t0;
    	let div1;
    	let div0;
    	let span;
    	let t1;
    	let t2;
    	let p;
    	let t3;
    	let img;
    	let img_src_value;
    	let div1_class_value;
    	let current;
    	const tailwindcss = new Tailwindcss({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(tailwindcss.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			div0 = element("div");
    			span = element("span");
    			t1 = text(/*title*/ ctx[3]);
    			t2 = space();
    			p = element("p");
    			t3 = space();
    			img = element("img");
    			attr_dev(span, "class", "font-sans font-bold text-6xl tracking-tighter text-white ");
    			add_location(span, file$a, 17, 4, 572);
    			attr_dev(p, "class", "font-sans font-normal text-base leading-loose text-white");
    			add_location(p, file$a, 20, 4, 675);
    			attr_dev(div0, "class", "flex flex-col lg:flex-col-reverse lg:w-5/12 lg:py-8 lg:pl-16");
    			add_location(div0, file$a, 16, 2, 493);
    			if (img.src !== (img_src_value = /*src*/ ctx[1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "featured-project-prototypes");
    			attr_dev(img, "class", "my-12 px-8 block lg:absolute inset-y-0 right-0 lg:max-h-screen py-0\n    lg:pb-64");
    			add_location(img, file$a, 27, 2, 943);
    			attr_dev(div1, "class", div1_class_value = "bg-black p-8 -mx-2 lg:ml-32 w-full " + /*classes*/ ctx[0]);
    			add_location(div1, file$a, 15, 0, 432);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(tailwindcss, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, span);
    			append_dev(span, t1);
    			append_dev(div0, t2);
    			append_dev(div0, p);
    			p.innerHTML = /*description*/ ctx[2];
    			append_dev(div1, t3);
    			append_dev(div1, img);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*title*/ 8) set_data_dev(t1, /*title*/ ctx[3]);
    			if (!current || dirty & /*description*/ 4) p.innerHTML = /*description*/ ctx[2];
    			if (!current || dirty & /*src*/ 2 && img.src !== (img_src_value = /*src*/ ctx[1])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (!current || dirty & /*classes*/ 1 && div1_class_value !== (div1_class_value = "bg-black p-8 -mx-2 lg:ml-32 w-full " + /*classes*/ ctx[0])) {
    				attr_dev(div1, "class", div1_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tailwindcss.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tailwindcss.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tailwindcss, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { classes = "" } = $$props;
    	let { url = "" } = $$props;
    	let { src = "" } = $$props;
    	let { description = "" } = $$props;
    	let { title = "" } = $$props;
    	const writable_props = ["classes", "url", "src", "description", "title"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ProjectOverview> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("classes" in $$props) $$invalidate(0, classes = $$props.classes);
    		if ("url" in $$props) $$invalidate(4, url = $$props.url);
    		if ("src" in $$props) $$invalidate(1, src = $$props.src);
    		if ("description" in $$props) $$invalidate(2, description = $$props.description);
    		if ("title" in $$props) $$invalidate(3, title = $$props.title);
    	};

    	$$self.$capture_state = () => {
    		return { classes, url, src, description, title };
    	};

    	$$self.$inject_state = $$props => {
    		if ("classes" in $$props) $$invalidate(0, classes = $$props.classes);
    		if ("url" in $$props) $$invalidate(4, url = $$props.url);
    		if ("src" in $$props) $$invalidate(1, src = $$props.src);
    		if ("description" in $$props) $$invalidate(2, description = $$props.description);
    		if ("title" in $$props) $$invalidate(3, title = $$props.title);
    	};

    	return [classes, src, description, title, url];
    }

    class ProjectOverview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$b, safe_not_equal, {
    			classes: 0,
    			url: 4,
    			src: 1,
    			description: 2,
    			title: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ProjectOverview",
    			options,
    			id: create_fragment$b.name
    		});
    	}

    	get classes() {
    		throw new Error("<ProjectOverview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set classes(value) {
    		throw new Error("<ProjectOverview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get url() {
    		throw new Error("<ProjectOverview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<ProjectOverview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get src() {
    		throw new Error("<ProjectOverview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set src(value) {
    		throw new Error("<ProjectOverview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get description() {
    		throw new Error("<ProjectOverview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set description(value) {
    		throw new Error("<ProjectOverview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get title() {
    		throw new Error("<ProjectOverview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<ProjectOverview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/footer/Footer.svelte generated by Svelte v3.18.0 */

    const file$b = "src/components/footer/Footer.svelte";

    function create_fragment$c(ctx) {
    	let t0;
    	let footer;
    	let div2;
    	let div0;
    	let span0;
    	let t1;
    	let br0;
    	let t2;
    	let br1;
    	let t3;
    	let t4;
    	let div1;
    	let span2;
    	let t5;
    	let span1;
    	let t7;
    	let hr;
    	let t8;
    	let div11;
    	let div8;
    	let span3;
    	let t10;
    	let div7;
    	let a0;
    	let div3;
    	let t11;
    	let a1;
    	let div4;
    	let t12;
    	let a2;
    	let div5;
    	let t13;
    	let a3;
    	let div6;
    	let t14;
    	let div10;
    	let t15;
    	let div9;
    	let span4;
    	let t17;
    	let a4;
    	let span5;
    	let current;
    	const tailwindcss = new Tailwindcss({ $$inline: true });
    	const linkedinicon = new LinkedinIcon({ $$inline: true });
    	const githubicon = new GithubIcon({ $$inline: true });
    	const twittericon = new TwitterIcon({ $$inline: true });
    	const instagramicon = new InstagramIcon({ $$inline: true });

    	const logo = new Logo({
    			props: { classes: "mb-8 lg:mb-0" },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(tailwindcss.$$.fragment);
    			t0 = space();
    			footer = element("footer");
    			div2 = element("div");
    			div0 = element("div");
    			span0 = element("span");
    			t1 = text("Robert C. Martin, Clean Code:\n        ");
    			br0 = element("br");
    			t2 = text("\n        A Handbook of Agile\n        ");
    			br1 = element("br");
    			t3 = text("\n        Software Craftsmanship");
    			t4 = space();
    			div1 = element("div");
    			span2 = element("span");
    			t5 = text("Clean code is not written by following a set of rules. You don’t become\n        a software craftsman by learning a list of heuristics. Professionalism\n        and craftsmanship come from values that drive\n        ");
    			span1 = element("span");
    			span1.textContent = "disciplines.";
    			t7 = space();
    			hr = element("hr");
    			t8 = space();
    			div11 = element("div");
    			div8 = element("div");
    			span3 = element("span");
    			span3.textContent = "get in touch";
    			t10 = space();
    			div7 = element("div");
    			a0 = element("a");
    			div3 = element("div");
    			create_component(linkedinicon.$$.fragment);
    			t11 = space();
    			a1 = element("a");
    			div4 = element("div");
    			create_component(githubicon.$$.fragment);
    			t12 = space();
    			a2 = element("a");
    			div5 = element("div");
    			create_component(twittericon.$$.fragment);
    			t13 = space();
    			a3 = element("a");
    			div6 = element("div");
    			create_component(instagramicon.$$.fragment);
    			t14 = space();
    			div10 = element("div");
    			create_component(logo.$$.fragment);
    			t15 = space();
    			div9 = element("div");
    			span4 = element("span");
    			span4.textContent = "proudly made in jakarta, ID";
    			t17 = space();
    			a4 = element("a");
    			span5 = element("span");

    			span5.textContent = `
            @${/*currentYear*/ ctx[0]} / masbossun LLC.
          `;

    			add_location(br0, file$b, 33, 8, 1192);
    			add_location(br1, file$b, 35, 8, 1235);
    			attr_dev(span0, "class", "font-sans font-bold text-3xl lg:text-4xl leading-tight\n        tracking-tighter lg:opacity-10");
    			add_location(span0, file$b, 29, 6, 1029);
    			attr_dev(div0, "class", "lg:absolute top-0 right-0 mt-4 lg:mr-24 text-center lg:text-right");
    			add_location(div0, file$b, 27, 4, 937);
    			attr_dev(span1, "class", "font-serif italic");
    			add_location(span1, file$b, 44, 8, 1664);
    			attr_dev(span2, "class", "font-sans font-normal text-xl md:text-4xl leading-relaxed");
    			add_location(span2, file$b, 40, 6, 1370);
    			attr_dev(div1, "class", "p-8 mr-0 lg:mx-32 z-10 text-center lg:text-left");
    			add_location(div1, file$b, 39, 4, 1302);
    			attr_dev(div2, "class", "flex flex-col lg:flex-row justify-center items-center relative\n    content svelte-1qr63o6");
    			add_location(div2, file$b, 24, 2, 840);
    			attr_dev(hr, "class", "my-12");
    			add_location(hr, file$b, 49, 2, 1753);
    			attr_dev(span3, "class", "font-sans font-bold text-2xl mb-8 lg:mb-0");
    			add_location(span3, file$b, 53, 6, 1868);
    			attr_dev(div3, "class", "w-8 text-black mx-4");
    			add_location(div3, file$b, 58, 10, 2051);
    			attr_dev(a0, "href", "https://linkedin.com/in/ryan-setiagi");
    			add_location(a0, file$b, 57, 8, 1993);
    			attr_dev(div4, "class", "w-8 text-black mx-4");
    			add_location(div4, file$b, 63, 10, 2202);
    			attr_dev(a1, "href", "https://github.com/masbossun");
    			add_location(a1, file$b, 62, 8, 2152);
    			attr_dev(div5, "class", "w-8 text-black mx-4");
    			add_location(div5, file$b, 68, 10, 2352);
    			attr_dev(a2, "href", "https://twitter.com/masbossun");
    			add_location(a2, file$b, 67, 8, 2301);
    			attr_dev(div6, "class", "w-8 text-black mx-4");
    			add_location(div6, file$b, 73, 10, 2505);
    			attr_dev(a3, "href", "https://instagram.com/masbossun");
    			add_location(a3, file$b, 72, 8, 2452);
    			attr_dev(div7, "class", "flex");
    			add_location(div7, file$b, 56, 6, 1966);
    			attr_dev(div8, "class", "flex flex-col lg:flex-row items-center justify-between mb-24");
    			add_location(div8, file$b, 52, 4, 1787);
    			attr_dev(span4, "class", "font-sans text-black mx-4 mb-4 lg:mb-0");
    			add_location(span4, file$b, 83, 8, 2807);
    			attr_dev(span5, "class", "font-serif text-black");
    			add_location(span5, file$b, 87, 10, 2946);
    			attr_dev(a4, "href", "#");
    			add_location(a4, file$b, 86, 8, 2923);
    			attr_dev(div9, "class", "flex items-center flex-col lg:flex-row");
    			add_location(div9, file$b, 82, 6, 2746);
    			attr_dev(div10, "class", "flex flex-col lg:flex-row justify-between items-center mb-8");
    			add_location(div10, file$b, 80, 4, 2628);
    			add_location(div11, file$b, 51, 2, 1777);
    			attr_dev(footer, "id", "footer");
    			add_location(footer, file$b, 23, 0, 817);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(tailwindcss, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, footer, anchor);
    			append_dev(footer, div2);
    			append_dev(div2, div0);
    			append_dev(div0, span0);
    			append_dev(span0, t1);
    			append_dev(span0, br0);
    			append_dev(span0, t2);
    			append_dev(span0, br1);
    			append_dev(span0, t3);
    			append_dev(div2, t4);
    			append_dev(div2, div1);
    			append_dev(div1, span2);
    			append_dev(span2, t5);
    			append_dev(span2, span1);
    			append_dev(footer, t7);
    			append_dev(footer, hr);
    			append_dev(footer, t8);
    			append_dev(footer, div11);
    			append_dev(div11, div8);
    			append_dev(div8, span3);
    			append_dev(div8, t10);
    			append_dev(div8, div7);
    			append_dev(div7, a0);
    			append_dev(a0, div3);
    			mount_component(linkedinicon, div3, null);
    			append_dev(div7, t11);
    			append_dev(div7, a1);
    			append_dev(a1, div4);
    			mount_component(githubicon, div4, null);
    			append_dev(div7, t12);
    			append_dev(div7, a2);
    			append_dev(a2, div5);
    			mount_component(twittericon, div5, null);
    			append_dev(div7, t13);
    			append_dev(div7, a3);
    			append_dev(a3, div6);
    			mount_component(instagramicon, div6, null);
    			append_dev(div11, t14);
    			append_dev(div11, div10);
    			mount_component(logo, div10, null);
    			append_dev(div10, t15);
    			append_dev(div10, div9);
    			append_dev(div9, span4);
    			append_dev(div9, t17);
    			append_dev(div9, a4);
    			append_dev(a4, span5);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tailwindcss.$$.fragment, local);
    			transition_in(linkedinicon.$$.fragment, local);
    			transition_in(githubicon.$$.fragment, local);
    			transition_in(twittericon.$$.fragment, local);
    			transition_in(instagramicon.$$.fragment, local);
    			transition_in(logo.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tailwindcss.$$.fragment, local);
    			transition_out(linkedinicon.$$.fragment, local);
    			transition_out(githubicon.$$.fragment, local);
    			transition_out(twittericon.$$.fragment, local);
    			transition_out(instagramicon.$$.fragment, local);
    			transition_out(logo.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tailwindcss, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(footer);
    			destroy_component(linkedinicon);
    			destroy_component(githubicon);
    			destroy_component(twittericon);
    			destroy_component(instagramicon);
    			destroy_component(logo);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { classes = "" } = $$props;
    	let currentYear = new Date().getFullYear();
    	const writable_props = ["classes"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("classes" in $$props) $$invalidate(1, classes = $$props.classes);
    	};

    	$$self.$capture_state = () => {
    		return { classes, currentYear };
    	};

    	$$self.$inject_state = $$props => {
    		if ("classes" in $$props) $$invalidate(1, classes = $$props.classes);
    		if ("currentYear" in $$props) $$invalidate(0, currentYear = $$props.currentYear);
    	};

    	return [currentYear, classes];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$c, safe_not_equal, { classes: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$c.name
    		});
    	}

    	get classes() {
    		throw new Error("<Footer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set classes(value) {
    		throw new Error("<Footer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.18.0 */
    const file$c = "src/App.svelte";

    // (29:2) {#if positionY >= contentHeight * 0.8}
    function create_if_block$1(ctx) {
    	let button;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "UP";
    			attr_dev(button, "class", "hidden lg:block fixed bottom-0 right-0 mr-12 mb-12 p-8 z-10\n      bg-white");
    			add_location(button, file$c, 29, 4, 1051);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			dispose = listen_dev(button, "click", /*click_handler*/ ctx[3], false, false, false);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(29:2) {#if positionY >= contentHeight * 0.8}",
    		ctx
    	});

    	return block;
    }

    // (39:2) <Content     bind:clientHeight={contentHeight}     classes="flex flex-col lg:flex-row justify-center items-center py-16 lg:py-0">
    function create_default_slot_4(ctx) {
    	let div1;
    	let span1;
    	let t0;
    	let span0;
    	let t2;
    	let div0;
    	let span2;
    	let t4;
    	let div2;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			span1 = element("span");
    			t0 = text("i am a frontend web and mobile developer who crafts codes with\n        ");
    			span0 = element("span");
    			span0.textContent = "passion.";
    			t2 = space();
    			div0 = element("div");
    			span2 = element("span");
    			span2.textContent = "featured project: waruung";
    			t4 = space();
    			div2 = element("div");
    			img = element("img");
    			attr_dev(span0, "class", "font-serif italic font-normal");
    			add_location(span0, file$c, 47, 8, 1679);
    			attr_dev(span1, "class", "font-sans font-bold text-5xl lg:text-6xl leading-tight\n        tracking-tighter text-center lg:text-left ");
    			add_location(span1, file$c, 43, 6, 1471);
    			attr_dev(span2, "class", "underline");
    			add_location(span2, file$c, 50, 8, 1787);
    			attr_dev(div0, "class", "mt-16");
    			add_location(div0, file$c, 49, 6, 1759);
    			attr_dev(div1, "class", "flex flex-initial flex-col items-center lg:items-start lg:mr-12");
    			add_location(div1, file$c, 41, 4, 1381);
    			if (img.src !== (img_src_value = "images/project-waruung.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "featured-project-prototypes");
    			attr_dev(img, "class", "featured-image svelte-5hyyzv");
    			add_location(img, file$c, 54, 6, 1947);
    			attr_dev(div2, "class", "flex flex-initial mb-auto mt-32 xl:mt-24 px-12 lg:px-0");
    			add_location(div2, file$c, 53, 4, 1872);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, span1);
    			append_dev(span1, t0);
    			append_dev(span1, span0);
    			append_dev(div1, t2);
    			append_dev(div1, div0);
    			append_dev(div0, span2);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, img);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4.name,
    		type: "slot",
    		source: "(39:2) <Content     bind:clientHeight={contentHeight}     classes=\\\"flex flex-col lg:flex-row justify-center items-center py-16 lg:py-0\\\">",
    		ctx
    	});

    	return block;
    }

    // (62:2) <Content     id="bio"     classes="flex flex-col lg:flex-row justify-center items-center relative">
    function create_default_slot_3(ctx) {
    	let div0;
    	let span0;
    	let t0;
    	let br0;
    	let t1;
    	let br1;
    	let t2;
    	let t3;
    	let div1;
    	let span1;
    	let t5;
    	let div2;
    	let span2;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			span0 = element("span");
    			t0 = text("ik heb ryan,\n        ");
    			br0 = element("br");
    			t1 = text("\n        leuk je\n        ");
    			br1 = element("br");
    			t2 = text("\n        te untmoeten");
    			t3 = space();
    			div1 = element("div");
    			span1 = element("span");
    			span1.textContent = "//";
    			t5 = space();
    			div2 = element("div");
    			span2 = element("span");
    			span2.textContent = "Hello, My name is Ryan Setiagi, self-motivated Frontend Developers who\n        love to learn new things. My background is telecommunication. I used to\n        code on vim and i am bad at typing. Most recently, i was a student at\n        telkom university (2016-2019). I want to love reading and writing as\n        well. You can find @masbossun on every daily social media.";
    			add_location(br0, file$c, 69, 8, 2441);
    			add_location(br1, file$c, 71, 8, 2472);
    			attr_dev(span0, "class", "font-sans font-bold text-5xl lg:text-6xl leading-tight\n        tracking-tighter text-center lg:text-left opacity-10");
    			add_location(span0, file$c, 65, 6, 2273);
    			attr_dev(div0, "class", "hidden lg:block absolute bottom-0 left-0 mb-48 ml-32");
    			add_location(div0, file$c, 64, 4, 2200);
    			attr_dev(span1, "class", "font-display italic text-5xl lg:text-6xl");
    			add_location(span1, file$c, 76, 6, 2603);
    			attr_dev(div1, "class", "hidden lg:block absolute bottom-0 right-0 mb-56 mr-32");
    			add_location(div1, file$c, 75, 4, 2529);
    			attr_dev(span2, "class", "font-sans font-normal text-xl md:text-4xl leading-loose ");
    			add_location(span2, file$c, 79, 6, 2765);
    			attr_dev(div2, "class", "p-8 ml-0 lg:ml-56 mr-0 lg:mr-16 z-10 text-center lg:text-left");
    			add_location(div2, file$c, 78, 4, 2683);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, span0);
    			append_dev(span0, t0);
    			append_dev(span0, br0);
    			append_dev(span0, t1);
    			append_dev(span0, br1);
    			append_dev(span0, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, span1);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, span2);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(62:2) <Content     id=\\\"bio\\\"     classes=\\\"flex flex-col lg:flex-row justify-center items-center relative\\\">",
    		ctx
    	});

    	return block;
    }

    // (90:2) <Content     id="projects"     classes="flex flex-col lg:flex-row items-center relative">
    function create_default_slot_2(ctx) {
    	let current;

    	const projectoverview = new ProjectOverview({
    			props: {
    				url: "#",
    				title: "waruung",
    				src: "images/project-waruung.png",
    				description: `
        Waruung is food ordering platform. With waruung user can order kind of
        food, drink, baverages, etc from warung—indonesian minimart. Waruung has
        two different apps, for user and the merchant. Waruung mechant will
        sent. orders with their own express and fee.
        <br />
        <br />
        With waruung, people can just order food easly.
    `
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(projectoverview.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(projectoverview, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(projectoverview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(projectoverview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(projectoverview, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(90:2) <Content     id=\\\"projects\\\"     classes=\\\"flex flex-col lg:flex-row items-center relative\\\">",
    		ctx
    	});

    	return block;
    }

    // (108:2) <Content classes="flex flex-col lg:flex-row items-center relative">
    function create_default_slot_1(ctx) {
    	let current;

    	const projectoverview = new ProjectOverview({
    			props: {
    				url: "#",
    				title: "hijrah",
    				src: "images/project-hijrah.png",
    				description: "Quran is the Muslim holy book, but because of the sanctity of the Quran, people sometimes choose to keep it in a cupboard rather than carryin it. What if everything can be accessed easily via a smartphone. Quran apps with a simple interface and easy to use, can be the choice of the people, to focus on worship."
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(projectoverview.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(projectoverview, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(projectoverview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(projectoverview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(projectoverview, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(108:2) <Content classes=\\\"flex flex-col lg:flex-row items-center relative\\\">",
    		ctx
    	});

    	return block;
    }

    // (116:2) <Content classes="flex flex-col lg:flex-row items-center relative">
    function create_default_slot(ctx) {
    	let current;

    	const projectoverview = new ProjectOverview({
    			props: {
    				url: "#",
    				title: "bukom",
    				src: "images/project-bukom-digital.png",
    				description: `
        With my colleague we made system that connect playgroup teacher with parents.
        Communcation is necessary, parents will happy if they know what their children
        achive everyday. Even teacher with ease can deliver information to parents
        before they skip.
        <br />
        <br />
        For playrgroup firm, they also can give parents events or news
        in realtime.
      `
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(projectoverview.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(projectoverview, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(projectoverview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(projectoverview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(projectoverview, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(116:2) <Content classes=\\\"flex flex-col lg:flex-row items-center relative\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment$d(ctx) {
    	let scrolling = false;

    	let clear_scrolling = () => {
    		scrolling = false;
    	};

    	let scrolling_timeout;
    	let t0;
    	let t1;
    	let div;
    	let t2;
    	let t3;
    	let updating_clientHeight;
    	let t4;
    	let t5;
    	let t6;
    	let t7;
    	let t8;
    	let current;
    	let dispose;
    	add_render_callback(/*onwindowscroll*/ ctx[2]);
    	const tailwindcss = new Tailwindcss({ $$inline: true });
    	let if_block = /*positionY*/ ctx[0] >= /*contentHeight*/ ctx[1] * 0.8 && create_if_block$1(ctx);
    	const navbar = new Navbar({ $$inline: true });

    	function content0_clientHeight_binding(value) {
    		/*content0_clientHeight_binding*/ ctx[4].call(null, value);
    	}

    	let content0_props = {
    		classes: "flex flex-col lg:flex-row justify-center items-center py-16 lg:py-0",
    		$$slots: { default: [create_default_slot_4] },
    		$$scope: { ctx }
    	};

    	if (/*contentHeight*/ ctx[1] !== void 0) {
    		content0_props.clientHeight = /*contentHeight*/ ctx[1];
    	}

    	const content0 = new Content({ props: content0_props, $$inline: true });
    	binding_callbacks.push(() => bind(content0, "clientHeight", content0_clientHeight_binding));

    	const content1 = new Content({
    			props: {
    				id: "bio",
    				classes: "flex flex-col lg:flex-row justify-center items-center relative",
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const content2 = new Content({
    			props: {
    				id: "projects",
    				classes: "flex flex-col lg:flex-row items-center relative",
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const content3 = new Content({
    			props: {
    				classes: "flex flex-col lg:flex-row items-center relative",
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const content4 = new Content({
    			props: {
    				classes: "flex flex-col lg:flex-row items-center relative",
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			t0 = space();
    			create_component(tailwindcss.$$.fragment);
    			t1 = space();
    			div = element("div");
    			if (if_block) if_block.c();
    			t2 = space();
    			create_component(navbar.$$.fragment);
    			t3 = space();
    			create_component(content0.$$.fragment);
    			t4 = space();
    			create_component(content1.$$.fragment);
    			t5 = space();
    			create_component(content2.$$.fragment);
    			t6 = space();
    			create_component(content3.$$.fragment);
    			t7 = space();
    			create_component(content4.$$.fragment);
    			t8 = space();
    			create_component(footer.$$.fragment);
    			attr_dev(div, "class", "container mx-auto");
    			add_location(div, file$c, 27, 0, 974);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			mount_component(tailwindcss, target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    			append_dev(div, t2);
    			mount_component(navbar, div, null);
    			append_dev(div, t3);
    			mount_component(content0, div, null);
    			append_dev(div, t4);
    			mount_component(content1, div, null);
    			append_dev(div, t5);
    			mount_component(content2, div, null);
    			append_dev(div, t6);
    			mount_component(content3, div, null);
    			append_dev(div, t7);
    			mount_component(content4, div, null);
    			append_dev(div, t8);
    			mount_component(footer, div, null);
    			current = true;

    			dispose = listen_dev(window, "scroll", () => {
    				scrolling = true;
    				clearTimeout(scrolling_timeout);
    				scrolling_timeout = setTimeout(clear_scrolling, 100);
    				/*onwindowscroll*/ ctx[2]();
    			});
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*positionY*/ 1 && !scrolling) {
    				scrolling = true;
    				clearTimeout(scrolling_timeout);
    				scrollTo(window.pageXOffset, /*positionY*/ ctx[0]);
    				scrolling_timeout = setTimeout(clear_scrolling, 100);
    			}

    			if (/*positionY*/ ctx[0] >= /*contentHeight*/ ctx[1] * 0.8) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(div, t2);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			const content0_changes = {};

    			if (dirty & /*$$scope*/ 32) {
    				content0_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_clientHeight && dirty & /*contentHeight*/ 2) {
    				updating_clientHeight = true;
    				content0_changes.clientHeight = /*contentHeight*/ ctx[1];
    				add_flush_callback(() => updating_clientHeight = false);
    			}

    			content0.$set(content0_changes);
    			const content1_changes = {};

    			if (dirty & /*$$scope*/ 32) {
    				content1_changes.$$scope = { dirty, ctx };
    			}

    			content1.$set(content1_changes);
    			const content2_changes = {};

    			if (dirty & /*$$scope*/ 32) {
    				content2_changes.$$scope = { dirty, ctx };
    			}

    			content2.$set(content2_changes);
    			const content3_changes = {};

    			if (dirty & /*$$scope*/ 32) {
    				content3_changes.$$scope = { dirty, ctx };
    			}

    			content3.$set(content3_changes);
    			const content4_changes = {};

    			if (dirty & /*$$scope*/ 32) {
    				content4_changes.$$scope = { dirty, ctx };
    			}

    			content4.$set(content4_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tailwindcss.$$.fragment, local);
    			transition_in(navbar.$$.fragment, local);
    			transition_in(content0.$$.fragment, local);
    			transition_in(content1.$$.fragment, local);
    			transition_in(content2.$$.fragment, local);
    			transition_in(content3.$$.fragment, local);
    			transition_in(content4.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tailwindcss.$$.fragment, local);
    			transition_out(navbar.$$.fragment, local);
    			transition_out(content0.$$.fragment, local);
    			transition_out(content1.$$.fragment, local);
    			transition_out(content2.$$.fragment, local);
    			transition_out(content3.$$.fragment, local);
    			transition_out(content4.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			destroy_component(tailwindcss, detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    			destroy_component(navbar);
    			destroy_component(content0);
    			destroy_component(content1);
    			destroy_component(content2);
    			destroy_component(content3);
    			destroy_component(content4);
    			destroy_component(footer);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let positionY;
    	let contentHeight;

    	function onwindowscroll() {
    		$$invalidate(0, positionY = window.pageYOffset);
    	}

    	const click_handler = () => scrollToTop();

    	function content0_clientHeight_binding(value) {
    		contentHeight = value;
    		$$invalidate(1, contentHeight);
    	}

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("positionY" in $$props) $$invalidate(0, positionY = $$props.positionY);
    		if ("contentHeight" in $$props) $$invalidate(1, contentHeight = $$props.contentHeight);
    	};

    	return [
    		positionY,
    		contentHeight,
    		onwindowscroll,
    		click_handler,
    		content0_clientHeight_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$d, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$d.name
    		});
    	}
    }

    const app = new App({
      target: document.body,
      props: {
        name: "world"
      }
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
