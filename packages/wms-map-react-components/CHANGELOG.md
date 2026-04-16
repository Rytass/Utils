# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.1.5](https://github.com/Rytass/Utils/compare/@rytass/wms-map-react-components@0.1.4...@rytass/wms-map-react-components@0.1.5) (2026-04-16)

### Bug Fixes

- **packages:** remove @mezzanine-ui/react-hook-form-v2 ([cb366d3](https://github.com/Rytass/Utils/commit/cb366d3123b2a49c8863b9739c866644fbec92da))
- **packages:** storybook issues ([52f2c3a](https://github.com/Rytass/Utils/commit/52f2c3af2c6c48d09788f23f15f3d07a43fca076))

## [0.1.4](https://github.com/Rytass/Utils/compare/@rytass/wms-map-react-components@0.1.3...@rytass/wms-map-react-components@0.1.4) (2026-02-24)

**Note:** Version bump only for package @rytass/wms-map-react-components

## [0.1.3](https://github.com/Rytass/Utils/compare/@rytass/wms-map-react-components@0.1.2...@rytass/wms-map-react-components@0.1.3) (2025-12-05)

### Bug Fixes

- **wms-map-react-components:** use framework package for Storybook imports ([543ace4](https://github.com/Rytass/Utils/commit/543ace43a16bf3bc0d8d5e0dd909d22c8a70c41c))

### chore

- **wms-map-react-components:** upgrade Storybook to v10.1.4 ([8802b34](https://github.com/Rytass/Utils/commit/8802b3441ef82200f95e4eadb7ac0a3e4908b3fc))

### BREAKING CHANGES

- **wms-map-react-components:** Storybook 10 is ESM-only. Configuration files now use
  import.meta.url for path resolution.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.1.2](https://github.com/Rytass/Utils/compare/@rytass/wms-map-react-components@0.1.1...@rytass/wms-map-react-components@0.1.2) (2025-09-11)

### Features

- align frontend-backend interfaces for WMS map range data ([5b883a7](https://github.com/Rytass/Utils/commit/5b883a7e69c9fab16cf426bf1becfabd3d4b5ba8))
- migrate to Nx project-based configuration ([c2d9ca4](https://github.com/Rytass/Utils/commit/c2d9ca46c00ace42bcbf69300dcc43a7346cb9aa))

### Tests

- migrate to standardized test structure ([b7dc99e](https://github.com/Rytass/Utils/commit/b7dc99ef85f5951480dfdae6198cefa252c15423))

### BREAKING CHANGES

- Test directory structure changed from **test** to **tests**

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## 0.1.1 (2025-09-09)

### Bug Fixes

- add file-type ESM compatibility and test fixes ([42de851](https://github.com/Rytass/Utils/commit/42de8515f7a111588206d9b2ffb7c20b382bb90d))
- **wms-map-react-components:** fix case-sensitive file system compatibility ([a94a51b](https://github.com/Rytass/Utils/commit/a94a51b0836dc8d33e02c1f3672cfd57f30b438a))
- **wms-map-react-components:** resolve React hooks dependency warning ([47cbe41](https://github.com/Rytass/Utils/commit/47cbe41823379bddfd3cc582825dec8b023d57a9))
- **wms-map-react-components:** resolve remaining ESLint violations ([ad20df1](https://github.com/Rytass/Utils/commit/ad20df1cd412059e82b3c0a6dc7c4fa0411b383f))
- **wms-map-react-components:** resolve TypeScript compilation errors ([5d7ba43](https://github.com/Rytass/Utils/commit/5d7ba43e430a507ed2b443287c97fb886cf83bd3))
- **wms-map-react-components:** resolve TypeScript ESLint violations ([4c8d12e](https://github.com/Rytass/Utils/commit/4c8d12e33f476b0b00474a4feb6a6c31a95247d9))
- **wms:** removes auto fit view on load ([1a4947a](https://github.com/Rytass/Utils/commit/1a4947a32b7ac4a003cf30f2f099f48321be3e01))
- **wms:** 修正檢視模式要按著空白鍵才能拖曳畫布的問題 ([5963d53](https://github.com/Rytass/Utils/commit/5963d53024db65273b9a79efba2c71b48d530dad))
- **wms:** 修正滑鼠滾輪無法正確放大縮小畫布的問題 ([a5b813c](https://github.com/Rytass/Utils/commit/a5b813cd234d48bd70dd183857e3ff588bc978a7))
- **wms:** 修正編輯圖形內文字時，按 delete 刪除文字時會把圖形刪除的問題 ([fc106fb](https://github.com/Rytass/Utils/commit/fc106fbb5398612fc1e7b92820445e28c446c951))
- **wms:** 修正若編輯的最後一步驟為編輯文字時，redo \ undo 沒有正確紀錄的問題 ([e3050c4](https://github.com/Rytass/Utils/commit/e3050c44baa4232911bb57d0c33a12458e3b36b1))
- **wms:** 修正讀取進來的資料， 底圖無法使用 delete 按鍵刪除的問題 ([f05455d](https://github.com/Rytass/Utils/commit/f05455d35fe001e878f45324066842438b94d081))
- **wms:** 鋼筆工具 - 修正按著 shift 會觸發自動閉合的情況 ([e6eb8d1](https://github.com/Rytass/Utils/commit/e6eb8d1db97258c0b9e826b06e292e4db668e5d8))
- **wms:** 麵包屑 - 修正下拉選單無法點擊的問題 ([6a807e4](https://github.com/Rytass/Utils/commit/6a807e422fba5cf4f710ce7198a681220789cf74))

### Features

- add test:coverage script to all packages ([f73bce5](https://github.com/Rytass/Utils/commit/f73bce52024d453755824fa6af784f13da50061f))
- upgrade file-type from v16.5.4 to v21.0.0 ([eb8217b](https://github.com/Rytass/Utils/commit/eb8217b76c4a0d74061f782c082fd4183961bb12))
- **wmd:** 矩形繪製工具 - 修正底色透明度 ([cee04c7](https://github.com/Rytass/Utils/commit/cee04c7caf2af35fa460edc676810d0bb1e9f97a))
- **wms-map-react-components:** migrate mock data to Storybook with interactive testing ([c52f88f](https://github.com/Rytass/Utils/commit/c52f88fe5d4c3de58034750ded806a75a7ca6264))
- **wms:** initialize ([ee4d443](https://github.com/Rytass/Utils/commit/ee4d4435cd57e5d06a67842e65d669ccecef5d0b))
- **wms:** redo / undo ([254be46](https://github.com/Rytass/Utils/commit/254be4613891931d1baa939a8be8fcdfff982419))
- **wms:** redo \ undo 會記錄圖層或底圖模式 ([f46018f](https://github.com/Rytass/Utils/commit/f46018f60f768badd05e8b229c217cd25e5b2e4b))
- **wms:** toolbar - 上傳 ([05064eb](https://github.com/Rytass/Utils/commit/05064eb1246664d9039d3527582c93f8b49a5917))
- **wms:** toolbar - 多張上傳 ([ad99de7](https://github.com/Rytass/Utils/commit/ad99de79df71a02d4ace183d81a6a3b035b314f8))
- **wms:** toolbar - 底圖、圖層模式切換 ([6ce26c0](https://github.com/Rytass/Utils/commit/6ce26c05191d05276e0549e9c37b44e8241bf99b))
- **wms:** toolbar - 底圖縮放 ([497f378](https://github.com/Rytass/Utils/commit/497f3789cb9c3f4e387619c8239dc8a820c5e4e3))
- **wms:** 儲存時 console.log ([3f1da0f](https://github.com/Rytass/Utils/commit/3f1da0f05b417595fc09caf0aaac6efbb4190109))
- **wms:** 右上 toolbar 的 active UI 狀態 ([ef32673](https://github.com/Rytass/Utils/commit/ef326737d065ec98fbcecbaaf245a7e4edba2cfb))
- **wms:** 右鍵選單 - 刪除 - 鍵盤快捷鍵 ([10f19fe](https://github.com/Rytass/Utils/commit/10f19fead55580e0185d72984d14afdba2ce8f9d))
- **wms:** 右鍵選單 - 圖層刪除 ([673e776](https://github.com/Rytass/Utils/commit/673e776848624db0a01698793e66dd81940bef79))
- **wms:** 右鍵選單 - 圖層複製並貼上 ([130cc60](https://github.com/Rytass/Utils/commit/130cc60f6b6afdfb03140ed8013b68f8106ee600))
- **wms:** 右鍵選單 - 底圖複製並貼上、刪除 ([a68aca9](https://github.com/Rytass/Utils/commit/a68aca9e6697d4a79aaa8487bc094505caa59000))
- **wms:** 右鍵選單 - 排列順序 ([26d0b87](https://github.com/Rytass/Utils/commit/26d0b87b1b92268d87427f516c0d0dff4b4cf38e))
- **wms:** 右鍵選單 - 排列順序 - 若所選項目已經是最前或是最後，相關選單 disable ([69bfed4](https://github.com/Rytass/Utils/commit/69bfed4aacec8416b58cba14f03f43273ce4d1ae))
- **wms:** 右鍵選單 - 複製並貼上 - 鍵盤快捷鍵 ([810dd95](https://github.com/Rytass/Utils/commit/810dd95b339e8773e8498a7070e88009d6ad2500))
- **wms:** 右鍵選單 - 複製並貼上 - 鍵盤快捷鍵 - 連續複製並貼上 ([494d602](https://github.com/Rytass/Utils/commit/494d6023cf967496db377cc85626d92c99fc2a7b))
- **wms:** 圖形 hover 效果 ([37b0eea](https://github.com/Rytass/Utils/commit/37b0eea9121dee6a571ad60ee679fd50ce87b0d8))
- **wms:** 將修改當前區域名稱的資料傳遞至 WmsMapModal 之外 ([49f99a2](https://github.com/Rytass/Utils/commit/49f99a26e986b4c86fad3d4fcdf41dfe2b64345a))
- **wms:** 將儲存的資料傳遞至 WmsMapModal 之外 ([98e627b](https://github.com/Rytass/Utils/commit/98e627bc411a5b0cb18a8d8b532ef3998d470b2a))
- **wms:** 將圖形的點擊資訊傳遞至 WmsMapModal 之外 ([a5daf1e](https://github.com/Rytass/Utils/commit/a5daf1ee3bf2ce1c370fdbed8db561bdffdcf988))
- **wms:** 將鋼筆工具繪製出的圖形的文字編輯樣式調整成和矩形工具的文字編輯樣式相同 ([22679b2](https://github.com/Rytass/Utils/commit/22679b254fb7b7643a0038b71fc003086a7e266d))
- **wms:** 左下 toolbar 的 active UI 狀態 ([38a0a7c](https://github.com/Rytass/Utils/commit/38a0a7c4b10e198fc5e55dc1568310bde2a84bcb))
- **wms:** 底圖和圖層模式的元件只能在相對應的模式下選取、編輯、拖曳 ([54dfe3f](https://github.com/Rytass/Utils/commit/54dfe3f06a2345e35d222c02cd421961e49a9ff3))
- **wms:** 底圖編輯 - 上傳底圖時，預設顯示位置為當前 view port ([2210be0](https://github.com/Rytass/Utils/commit/2210be04fe31a238cd678482a07ecf1915b9c578))
- **wms:** 檢視模式 ([18953d8](https://github.com/Rytass/Utils/commit/18953d8c08e946a47d09942290be918a2087abd8))
- **wms:** 檢視模式 - 關閉底圖 ([b89b524](https://github.com/Rytass/Utils/commit/b89b5240b4d993a675fd8dc9a263a3ec8ac65af6))
- **wms:** 歷史工具列 - 底圖模式 ([45dfe3f](https://github.com/Rytass/Utils/commit/45dfe3f6d35ef131d306175678eb6322b85b247f))
- **wms:** 測試讀取資料 ([7c1d834](https://github.com/Rytass/Utils/commit/7c1d834726feb6c62dbacd29e35267cba5d306ec))
- **wms:** 縮放工具列 - 與滑鼠滾輪縮放數值同步 ([c3d57bd](https://github.com/Rytass/Utils/commit/c3d57bdaa7e83572d4a060f618870035e6e11835))
- **wms:** 繪圖工具列 ([603ac71](https://github.com/Rytass/Utils/commit/603ac7186193fcedc7f3c197cdfde9b5fe58d55e))
- **wms:** 調色工具 ([4ed67b4](https://github.com/Rytass/Utils/commit/4ed67b450a775e366c56c39f645ac6fcadd3836a))
- **wms:** 鋼筆工具 ([7a86a6c](https://github.com/Rytass/Utils/commit/7a86a6cf6a5251f1db57a587a1d485faefc874e1))
- **wms:** 鋼筆工具 - 修正底色透明度 ([4a9a1fc](https://github.com/Rytass/Utils/commit/4a9a1fc763bee6e012a577c659bc522431f7f2c0))
- **wms:** 鋼筆工具 - 可編輯個別節點位置 ([27f413b](https://github.com/Rytass/Utils/commit/27f413bd973b49d4572ae223a84f79f7f0a5de55))
- **wms:** 鋼筆工具 - 繪製時若點擊非繪圖區域，圖形會自動閉合 ([2f2fa91](https://github.com/Rytass/Utils/commit/2f2fa91fcc0bfc7c3bcf58ac60105dd1111f79c2))
- **wms:** 鋼筆工具 - 點擊初始點閉合圖形 ([a0679ff](https://github.com/Rytass/Utils/commit/a0679ff51800aadaaafe380bc59675bc8d9f3561))
- **wms:** 鋼筆工具 shift 水平線 ([7b842a4](https://github.com/Rytass/Utils/commit/7b842a42107a6bfc536f1d9b431f37701e1ac6d9))
- **wms:** 鋼筆工具繪製區域可編輯文字 ([afaa641](https://github.com/Rytass/Utils/commit/afaa64102d1d9c43a5cd80e2ae40d5e2871c6597))
- **wms:** 顏色選取工具 - 使用 props array 顏色列表 ([7db92bf](https://github.com/Rytass/Utils/commit/7db92bfcb49a7d4dae47a06598186b972f4ffeb9))
- **wms:** 麵包屑 ([4a6a9b8](https://github.com/Rytass/Utils/commit/4a6a9b811b33adbaa4315aa97c82495f4fafbc08))
- **wms:** 麵包屑編輯名稱 modal ([8739e3d](https://github.com/Rytass/Utils/commit/8739e3d3c6b9ee1b9d8631f6e5d08c947063ad9a))

### BREAKING CHANGES

- file-type v21 is ESM-only, requires Node.js 18+

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
