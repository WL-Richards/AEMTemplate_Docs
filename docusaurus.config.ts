import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// Site is served from GitHub Pages under the repo name.
const baseUrl = '/AEMTemplate_Docs/';

// Bump this when the icon files change so browsers refetch them.
const iconVersion = 2;

const config: Config = {
  title: 'AEMTemplate',
  tagline: 'FRC Team 6443 robot code library',
  url: 'https://wl-richards.github.io',
  baseUrl,
  trailingSlash: false,

  organizationName: 'WL-Richards',
  projectName: 'AEMTemplate_Docs',

  favicon: `img/favicon.ico?v=${iconVersion}`,
  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '180x180',
        href: `${baseUrl}img/apple-touch-icon.png?v=${iconVersion}`,
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'apple-touch-icon',
        href: `${baseUrl}img/apple-touch-icon.png?v=${iconVersion}`,
      },
    },
  ],

  // Fail the build on anything that would produce a dead link.
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  future: {
    v4: true,
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        // Docs are the whole site, so they live at the root instead of /docs.
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/WL-Richards/AEMTemplate_Docs/tree/main/',
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    docs: {
      sidebar: {
        hideable: true,
      },
    },
    navbar: {
      title: 'AEMTemplate',
      logo: {
        alt: 'AEMBOT',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Documentation',
        },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `Copyright © ${new Date().getFullYear()} AEMBOT`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['java', 'bash'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
