# @rytass/wms-map-react-components

WMS (Warehouse Management System) Map React Components for interactive warehouse space editing.

## Installation

```bash
npm install @rytass/wms-map-react-components
```

## Peer Dependencies

```bash
npm install @mezzanine-ui/react @xyflow/react react react-dom
```

## Usage

```tsx
import React, { useState } from 'react';
import WmsMapModal from '@rytass/wms-map-react-components';
import { ViewMode } from '@rytass/wms-map-react-components/typings';

const App = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>Open Map Editor</button>

      <WmsMapModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        viewMode={ViewMode.EDIT}
        onSave={mapData => {
          console.log('Saved map data:', mapData);
        }}
        onNodeClick={nodeInfo => {
          console.log('Node clicked:', nodeInfo);
        }}
      />
    </div>
  );
};

export default App;
```

## Props

| Prop                  | Type                                                            | Default          | Description                          |
| --------------------- | --------------------------------------------------------------- | ---------------- | ------------------------------------ |
| `open`                | `boolean`                                                       | -                | Controls modal visibility            |
| `onClose`             | `() => void`                                                    | -                | Called when modal should close       |
| `viewMode`            | `ViewMode`                                                      | `ViewMode.EDIT`  | Initial view mode (EDIT/VIEW)        |
| `colorPalette`        | `string[]`                                                      | -                | Available colors for drawing tools   |
| `onNodeClick`         | `(nodeInfo: WmsNodeClickInfo) => void`                          | -                | Called when a node is clicked        |
| `onSave`              | `(mapData: Map) => void`                                        | -                | Called when save button is clicked   |
| `onBreadcrumbClick`   | `(warehouseId: string, index: number) => void`                  | -                | Called when breadcrumb is clicked    |
| `onNameChange`        | `(name: string) => Promise<void>`                               | -                | Called when warehouse name is changed |
| `initialNodes`        | `any[]`                                                         | `[]`             | Initial nodes for the canvas         |
| `initialEdges`        | `any[]`                                                         | `[]`             | Initial edges for the canvas         |
| `debugMode`           | `boolean`                                                       | `false`          | Enable debug logging                 |
| `title`               | `string`                                                        | `'編輯倉儲空間'` | Modal title                          |
| `fitViewOnLoad`       | `boolean`                                                       | `true`           | Fit the view when a different map is entered (`warehouseIds` changes) or a map first gets non-empty nodes. Adding or removing nodes on the same map never refits. Update `warehouseIds` no later than `initialNodes` when switching maps. |

## Styles

The components render with React Flow, whose stylesheet is not bundled. Import it once at the app level:

```tsx
import '@xyflow/react/dist/style.css';
```

## WMSMapPreview

Read-only preview with no toolbar, breadcrumb or context menu. It fits to the nodes once they are measured (to `highlightIds` when given) and refits when its container resizes.

```tsx
import { WMSMapPreview } from '@rytass/wms-map-react-components';

<WMSMapPreview initialNodes={nodes} highlightIds={['range-a']} style={{ width: 320, height: 200 }} />;
```

| Prop              | Type                                              | Default | Description                                                      |
| ----------------- | ------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `initialNodes`    | `FlowNode[]`                                      | -       | Nodes to render, same format as the modal                        |
| `highlightIds`    | `string[]`                                        | -       | Range ids to highlight and fit to                                |
| `dimOthers`       | `boolean`                                         | `true`  | Dim the other ranges while some are highlighted                  |
| `fitPadding`      | `number`                                          | `0.15`  | Fit padding as a ratio of the viewport                           |
| `interactive`     | `boolean`                                         | `false` | Allow pan and zoom; nodes are never selectable or editable       |
| `getFilenameFQDN` | `(filename: string) => Promise<string> \| string` | -       | Resolve each background's `fileName` to the image URL to display |
| `className`       | `string`                                          | -       | Class on the outer container                                     |
| `style`           | `CSSProperties`                                   | -       | Style on the outer container (defaults to 100% × 100%)           |

## Features

- **Interactive Canvas**: Built with ReactFlow for smooth interactions
- **Drawing Tools**: Rectangle and pen tools for creating warehouse areas
- **Background Images**: Upload and manage warehouse floor plans
- **Layer Management**: Separate background and layer editing modes
- **History System**: Complete undo/redo functionality
- **Export**: Transform canvas data to structured warehouse map format

## License

MIT
