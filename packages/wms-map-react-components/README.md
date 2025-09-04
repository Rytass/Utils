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
| `onWarehouseNameEdit` | `(warehouseId: string, newName: string, index: number) => void` | -                | Called when warehouse name is edited |
| `initialNodes`        | `any[]`                                                         | `[]`             | Initial nodes for the canvas         |
| `initialEdges`        | `any[]`                                                         | `[]`             | Initial edges for the canvas         |
| `debugMode`           | `boolean`                                                       | `false`          | Enable debug logging                 |
| `title`               | `string`                                                        | `'編輯倉儲空間'` | Modal title                          |

## Features

- **Interactive Canvas**: Built with ReactFlow for smooth interactions
- **Drawing Tools**: Rectangle and pen tools for creating warehouse areas
- **Background Images**: Upload and manage warehouse floor plans
- **Layer Management**: Separate background and layer editing modes
- **History System**: Complete undo/redo functionality
- **Export**: Transform canvas data to structured warehouse map format

## License

MIT
