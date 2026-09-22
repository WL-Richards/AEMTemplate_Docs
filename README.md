# AEMTemplate docs

Docusaurus site for the AEMTemplate library. Pages live in `docs/`.

```
npm install
npm start          # dev server with live reload
npm run build      # static output in build/
npm run format     # format everything with Prettier
npm run typecheck  # type-check the config
```

The sidebar is generated from the folder layout under `docs/`. To add a page, drop a Markdown file into the matching folder and set `sidebar_position` in its front matter. Each folder's `_category_.json` sets the section label and order.

Changes to `docusaurus.config.ts` or `sidebars.ts` need a dev server restart. Markdown edits hot reload.

Pushes to `main` build and deploy the site to GitHub Pages at https://wl-richards.github.io/AEMTemplate_Docs/ through `.github/workflows/deploy.yml`. Pull requests run the build without deploying.
