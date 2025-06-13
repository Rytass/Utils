# Rytass Utils - Logistics (TCat)

## Features

- [x] Trace single logistics
- [x] Trace multiple logistics

## Quick Start

```typescript
// use default setting 
import { TCatLogisticsService, TCatLogistics } from '@rytass/logistics-adapter-tcat'

const logistics = new TCatLogisticsService(TCatLogistics)

logistics.trace('800978442950')

logistics.trace(['800978442950', '903404283301'])
```

## Customization

```typescript
import { TCatLogisticsService, TCatLogisticsInterface } from '@rytass/logistics-adapter-tcat'

type customStatus = 'DELIVERED' | 'DELIVERING' | 'SHELVED' | 'CUSTOM_STATUS'

const customLogistics: TCatLogisticsInterface<customStatus> = {
   ignoreNotFound: false,
   url: 'https://www.t-cat.com.tw/Inquire/TraceDetail.aspx',
   statusMap(reference: string, id: string) => {
    // implement logic of status mapping with context in reference argument
  }
}

const logistics = new TCatLogisticsService(customLogistics)

logistics.trace('800978442950')

logistics.trace(['800978442950', '903404283301'])
```