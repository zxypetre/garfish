/* eslint-disable no-restricted-syntax */
import { def, warn } from '@garfish/utils';
import { Garfish } from './garfish';
import { __GARFISH_FLAG__ } from './utils';
import { BOOTSTRAP } from './eventFlags';

declare global {
  interface Window {
    Garfish: Garfish;
    __GARFISH__: boolean;
  }
}

// 主应用 hmr 导致的子应用渲染失败的问题
function fixHMR(context: Garfish) {
  let hasInit = false;
  let isHotUpdate = false;

  context.on(BOOTSTRAP, () => {
    if (hasInit) return;
    hasInit = true;
    const webpackHotUpdate = (window as any).webpackHotUpdate;

    if (typeof webpackHotUpdate === 'function') {
      (window as any).webpackHotUpdate = function () {
        isHotUpdate = true;
        return webpackHotUpdate.apply(this, arguments);
      };

      const observer = new MutationObserver(() => {
        if (!isHotUpdate) return;
        isHotUpdate = false;

        context.activeApps.forEach((app) => {
          if (app.mounted) {
            app.display && app.hide();
            app.show();
          }
        });
      });

      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
      });
    }
  });
}

// 初始化 Garfish，当前环境只允许一个实例存在
function createContext() {
  let fresh = false;
  const context = new Garfish({} as any);

  const set = (namespace: string, val: boolean | Garfish = context) => {
    if (namespace in window) {
      if (!(window[namespace] && window[namespace].flag === __GARFISH_FLAG__)) {
        const next = () => {
          fresh = true;
          warn(`"Window.${namespace}" will be overwritten by "@garfish/core".`);
        };
        const desc = Object.getOwnPropertyDescriptor(window, namespace);
        if (desc) {
          if (desc.configurable) {
            def(window, namespace, val);
            next();
          } else if (desc.enumerable) {
            window[namespace] = val;
            next();
          }
        }
      }
    } else {
      fresh = true;
      def(window, namespace, val);
    }
  };

  set('Gar');
  set('Garfish');

  // 全局标识符
  set('__GAR__', true);
  set('__GARFISH__', true);

  if (fresh) {
    // 兼容旧的 api

    if (__DEV__) {
      fixHMR(context);
      if (__VERSION__ !== window['Garfish'].version) {
        warn(
          'The "garfish version" used by the main and sub-applications is inconsistent.',
        );
      }
    }
  }

  return window['Garfish'];
}

export default createContext();
