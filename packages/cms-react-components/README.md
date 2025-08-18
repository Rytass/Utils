# Rytass Utils - CMS React Components

A comprehensive collection of production-ready React components for building content management systems. Built with Mezzanine UI design system, these components provide standardized interfaces for article management, workflow controls, permissions, and rich content editing with complete TypeScript support.

## Features

### Core Components
- [x] StandardCMSTable - Advanced data table with sorting, filtering, and actions
- [x] StandardCMSFormActions - Form submission with workflow actions
- [x] StandardCMSList - List view with pagination and selection
- [x] StandardCMSTabs - Tab-based content organization
- [x] Textarea with rich text support

### Modal Components
- [x] DeleteWithdrawModal - Article deletion/withdrawal confirmation
- [x] RejectModal - Article rejection with reasons
- [x] VerifyReleaseModal - Release verification workflow
- [x] LogsModal - Version history and audit logs

### Context Providers
- [x] DialogProvider - Centralized dialog management
- [x] ModalProvider - Modal state management
- [x] Permission utilities for role-based access
- [x] Built-in form validation with react-hook-form

### Article Workflow Management
- [x] Complete article lifecycle (Draft ’ Reviewing ’ Verified ’ Released)
- [x] Permission-based action controls
- [x] Multi-stage approval workflows
- [x] Version control integration

## Installation

```bash
npm install @rytass/cms-react-components
# Peer dependencies
npm install @mezzanine-ui/core @mezzanine-ui/react @mezzanine-ui/icons react react-dom react-hook-form dayjs lodash
# or
yarn add @rytass/cms-react-components
```

## Basic Setup

### Provider Configuration

```tsx
// App.tsx
import React from 'react';
import { CalendarConfigProvider } from '@mezzanine-ui/react';
import calendarMethodsDayjs from '@mezzanine-ui/core/calendarMethodsDayjs';
import { DialogProvider, ModalProvider } from '@rytass/cms-react-components';

function App() {
  return (
    <CalendarConfigProvider methods={calendarMethodsDayjs}>
      <DialogProvider>
        <ModalProvider>
          {/* Your app components */}
        </ModalProvider>
      </DialogProvider>
    </CalendarConfigProvider>
  );
}

export default App;
```

## Component Usage

### StandardCMSTable

A comprehensive data table component with built-in sorting, filtering, pagination, and row actions.

```tsx
import React from 'react';
import { StandardCMSTable, ArticleStage } from '@rytass/cms-react-components';
import { TableColumn } from '@mezzanine-ui/core/table';

interface Article {
  id: string;
  title: string;
  author: string;
  stage: ArticleStage;
  publishedAt: Date | null;
  updatedAt: Date;
}

const columns: TableColumn<Article>[] = [
  {
    title: 'Title',
    dataIndex: 'title',
    width: 300,
    ellipsis: true,
  },
  {
    title: 'Author',
    dataIndex: 'author',
    width: 150,
  },
  {
    title: 'Stage',
    dataIndex: 'stage',
    width: 120,
    render: (stage: ArticleStage) => (
      <StatusBadge stage={stage} />
    ),
  },
  {
    title: 'Published',
    dataIndex: 'publishedAt',
    width: 150,
    render: (date: Date | null) => 
      date ? new Date(date).toLocaleDateString() : '-',
  },
];

function ArticleManagement() {
  const [data, setData] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const handleTableChange = (params: any) => {
    // Handle pagination, sorting, filtering
    fetchArticles(params);
  };

  const handleAction = (action: string, record: Article) => {
    switch (action) {
      case 'edit':
        navigateToEdit(record.id);
        break;
      case 'delete':
        confirmDelete(record);
        break;
      case 'publish':
        publishArticle(record);
        break;
    }
  };

  return (
    <StandardCMSTable<Article>
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={pagination}
      onChange={handleTableChange}
      onAction={handleAction}
      rowKey="id"
      selectable
      actionColumn={{
        title: 'Actions',
        width: 150,
        actions: (record) => getActionsForStage(record.stage),
      }}
    />
  );
}
```

### StandardCMSFormActions

Form submission component with integrated workflow actions and validation.

```tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { 
  StandardCMSFormActions,
  ArticleStage 
} from '@rytass/cms-react-components';

interface ArticleFormData {
  title: string;
  content: string;
  categoryId: string;
  tags: string[];
  publishDate?: Date;
}

function ArticleForm({ article, onSubmit }: ArticleFormProps) {
  const form = useForm<ArticleFormData>({
    defaultValues: {
      title: article?.title || '',
      content: article?.content || '',
      categoryId: article?.categoryId || '',
      tags: article?.tags || [],
    },
  });

  const handleSave = async (data: ArticleFormData) => {
    await saveArticle(data);
    showSuccess('Article saved as draft');
  };

  const handleSubmitForReview = async (data: ArticleFormData) => {
    await submitForReview(data);
    showSuccess('Article submitted for review');
  };

  const handlePublish = async (data: ArticleFormData) => {
    await publishArticle(data);
    showSuccess('Article published successfully');
  };

  return (
    <form>
      {/* Form fields */}
      <input {...form.register('title', { required: true })} />
      <textarea {...form.register('content', { required: true })} />
      
      <StandardCMSFormActions
        form={form}
        stage={article?.stage || ArticleStage.DRAFT}
        permissions={userPermissions}
        onSave={handleSave}
        onSubmit={handleSubmitForReview}
        onPublish={handlePublish}
        disableActions={form.formState.isSubmitting}
        saveButtonText="Save Draft"
        submitButtonText="Submit for Review"
        publishButtonText="Publish Now"
        showScheduleOption
        onSchedule={(date) => schedulePublication(data, date)}
      />
    </form>
  );
}
```

### Modal Components

#### DeleteWithdrawModal

```tsx
import React, { useState } from 'react';
import { 
  DeleteWithdrawModal,
  useModal 
} from '@rytass/cms-react-components';

function ArticleActions({ article }: { article: Article }) {
  const { openModal, closeModal } = useModal();
  
  const handleDelete = () => {
    openModal({
      component: DeleteWithdrawModal,
      props: {
        title: 'Delete Article',
        message: `Are you sure you want to delete "${article.title}"?`,
        itemType: 'article',
        onConfirm: async () => {
          await deleteArticle(article.id);
          closeModal();
          refreshList();
        },
        onCancel: closeModal,
        severity: 'error',
      },
    });
  };

  const handleWithdraw = () => {
    openModal({
      component: DeleteWithdrawModal,
      props: {
        title: 'Withdraw Article',
        message: `Withdraw "${article.title}" from publication?`,
        itemType: 'article',
        requireReason: true,
        onConfirm: async (reason: string) => {
          await withdrawArticle(article.id, reason);
          closeModal();
          refreshList();
        },
        onCancel: closeModal,
        severity: 'warning',
      },
    });
  };

  return (
    <div>
      <button onClick={handleDelete}>Delete</button>
      <button onClick={handleWithdraw}>Withdraw</button>
    </div>
  );
}
```

#### RejectModal

```tsx
import React from 'react';
import { RejectModal, useModal } from '@rytass/cms-react-components';

function ReviewActions({ article }: { article: Article }) {
  const { openModal, closeModal } = useModal();
  
  const handleReject = () => {
    openModal({
      component: RejectModal,
      props: {
        title: 'Reject Article',
        itemName: article.title,
        reasons: [
          'Content needs improvement',
          'Missing required information',
          'Does not meet quality standards',
          'Contains inappropriate content',
          'Other',
        ],
        requireComment: true,
        onConfirm: async (reason: string, comment: string) => {
          await rejectArticle(article.id, { reason, comment });
          closeModal();
          showSuccess('Article rejected');
        },
        onCancel: closeModal,
      },
    });
  };

  return <button onClick={handleReject}>Reject</button>;
}
```

#### VerifyReleaseModal

```tsx
import React from 'react';
import { 
  VerifyReleaseModal,
  useModal 
} from '@rytass/cms-react-components';

function PublishActions({ article }: { article: Article }) {
  const { openModal, closeModal } = useModal();
  
  const handleVerifyAndRelease = () => {
    openModal({
      component: VerifyReleaseModal,
      props: {
        title: 'Verify and Release Article',
        article: {
          title: article.title,
          author: article.author,
          categories: article.categories,
          lastModified: article.updatedAt,
        },
        checklist: [
          'Content has been reviewed for accuracy',
          'All images have proper attribution',
          'SEO metadata is complete',
          'Links have been verified',
        ],
        requireAllChecks: true,
        showPreview: true,
        previewUrl: `/preview/${article.id}`,
        onConfirm: async (checkedItems: string[]) => {
          await verifyAndRelease(article.id, { checkedItems });
          closeModal();
          showSuccess('Article published successfully');
        },
        onCancel: closeModal,
      },
    });
  };

  return <button onClick={handleVerifyAndRelease}>Verify & Release</button>;
}
```

#### LogsModal

```tsx
import React from 'react';
import { LogsModal, useModal, LogEntry } from '@rytass/cms-react-components';

function ArticleHistory({ article }: { article: Article }) {
  const { openModal, closeModal } = useModal();
  
  const handleViewLogs = async () => {
    const logs = await fetchArticleLogs(article.id);
    
    openModal({
      component: LogsModal,
      props: {
        title: `History: ${article.title}`,
        logs: logs.map((log): LogEntry => ({
          id: log.id,
          timestamp: log.createdAt,
          user: log.user.name,
          action: log.action,
          details: log.details,
          changes: log.changes,
          version: log.version,
        })),
        showDiff: true,
        onRevert: async (logId: string) => {
          await revertToVersion(article.id, logId);
          closeModal();
          refreshArticle();
        },
        onClose: closeModal,
      },
    });
  };

  return <button onClick={handleViewLogs}>View History</button>;
}
```

### StandardCMSList

List view component for displaying content cards or items.

```tsx
import React from 'react';
import { StandardCMSList } from '@rytass/cms-react-components';

interface ListItem {
  id: string;
  title: string;
  thumbnail: string;
  description: string;
  status: string;
}

function ContentList() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelect = (ids: string[]) => {
    setSelectedIds(ids);
  };

  const handleBulkAction = (action: string) => {
    switch (action) {
      case 'delete':
        bulkDelete(selectedIds);
        break;
      case 'archive':
        bulkArchive(selectedIds);
        break;
    }
  };

  return (
    <StandardCMSList<ListItem>
      items={items}
      selectedIds={selectedIds}
      onSelect={handleSelect}
      renderItem={(item) => (
        <ContentCard
          key={item.id}
          title={item.title}
          thumbnail={item.thumbnail}
          description={item.description}
          status={item.status}
          onClick={() => navigateToDetail(item.id)}
        />
      )}
      bulkActions={[
        { label: 'Delete', value: 'delete', severity: 'error' },
        { label: 'Archive', value: 'archive' },
      ]}
      onBulkAction={handleBulkAction}
      emptyMessage="No content found"
      loading={loading}
    />
  );
}
```

### StandardCMSTabs

Tab navigation component for organizing content sections.

```tsx
import React, { useState } from 'react';
import { StandardCMSTabs } from '@rytass/cms-react-components';

function ArticleEditor() {
  const [activeTab, setActiveTab] = useState('content');

  const tabs = [
    {
      key: 'content',
      label: 'Content',
      badge: hasUnsavedChanges ? '"' : undefined,
    },
    {
      key: 'metadata',
      label: 'Metadata',
    },
    {
      key: 'seo',
      label: 'SEO',
      disabled: !article.published,
    },
    {
      key: 'history',
      label: 'History',
      badge: versionCount,
    },
  ];

  return (
    <StandardCMSTabs
      tabs={tabs}
      activeTab={activeTab}
      onChange={setActiveTab}
      variant="contained"
      fullWidth
    >
      {activeTab === 'content' && <ContentEditor />}
      {activeTab === 'metadata' && <MetadataForm />}
      {activeTab === 'seo' && <SEOSettings />}
      {activeTab === 'history' && <VersionHistory />}
    </StandardCMSTabs>
  );
}
```

## Permission Management

### Using Permission Utilities

```tsx
import { 
  havePermission,
  ArticlesPermissions 
} from '@rytass/cms-react-components';

function ArticleActions({ article, userPermissions }: Props) {
  const canEdit = havePermission(
    userPermissions,
    ArticlesPermissions.UpdateArticleInDraft
  );

  const canDelete = havePermission(
    userPermissions,
    ArticlesPermissions.DeleteArticleInDraft
  );

  const canSubmit = havePermission(
    userPermissions,
    ArticlesPermissions.SubmitPutBackArticle
  );

  const canApprove = havePermission(
    userPermissions,
    ArticlesPermissions.ApproveRejectArticle
  );

  return (
    <div>
      {canEdit && <button onClick={handleEdit}>Edit</button>}
      {canDelete && <button onClick={handleDelete}>Delete</button>}
      {canSubmit && <button onClick={handleSubmit}>Submit</button>}
      {canApprove && <button onClick={handleApprove}>Approve</button>}
    </div>
  );
}
```

### Permission-Based Table Actions

```tsx
import { 
  ArticleStage,
  ArticleTableActions,
  ArticleTableActionsType 
} from '@rytass/cms-react-components';

const getTableActions = (
  permissions: string[]
): ArticleTableActionsType => {
  const actions: ArticleTableActionsType = {};

  // Draft stage actions
  actions[ArticleStage.DRAFT] = [];
  if (havePermission(permissions, ArticlesPermissions.UpdateArticleInDraft)) {
    actions[ArticleStage.DRAFT].push(ArticleTableActions.Update);
  }
  if (havePermission(permissions, ArticlesPermissions.SubmitPutBackArticle)) {
    actions[ArticleStage.DRAFT].push(ArticleTableActions.Submit);
  }

  // Reviewing stage actions
  actions[ArticleStage.REVIEWING] = [];
  if (havePermission(permissions, ArticlesPermissions.ApproveRejectArticle)) {
    actions[ArticleStage.REVIEWING].push(ArticleTableActions.Review);
  }
  if (havePermission(permissions, ArticlesPermissions.SubmitPutBackArticle)) {
    actions[ArticleStage.REVIEWING].push(ArticleTableActions.PutBack);
  }

  // Released stage actions
  actions[ArticleStage.RELEASED] = [];
  if (havePermission(permissions, ArticlesPermissions.UpdateArticleInReleased)) {
    actions[ArticleStage.RELEASED].push(ArticleTableActions.Update);
  }
  if (havePermission(permissions, ArticlesPermissions.WithdrawArticleInReleased)) {
    actions[ArticleStage.RELEASED].push(ArticleTableActions.Withdraw);
  }

  return actions;
};
```

## Article Workflow States

The CMS components support a complete article lifecycle with the following stages:

```tsx
import { ArticleStage } from '@rytass/cms-react-components';

// Article lifecycle stages
const stages = {
  [ArticleStage.DRAFT]: 'Draft - Initial creation state',
  [ArticleStage.REVIEWING]: 'Under Review - Pending approval',
  [ArticleStage.VERIFIED]: 'Verified - Approved but not published',
  [ArticleStage.SCHEDULED]: 'Scheduled - Set for future publication',
  [ArticleStage.RELEASED]: 'Published - Live and public',
  [ArticleStage.UNKNOWN]: 'Unknown - Error or undefined state',
};

// Stage transitions
function getNextStage(currentStage: ArticleStage): ArticleStage | null {
  switch (currentStage) {
    case ArticleStage.DRAFT:
      return ArticleStage.REVIEWING;
    case ArticleStage.REVIEWING:
      return ArticleStage.VERIFIED;
    case ArticleStage.VERIFIED:
      return ArticleStage.RELEASED;
    default:
      return null;
  }
}
```

## Custom Hooks

### useDialog Hook

```tsx
import { useDialog } from '@rytass/cms-react-components';

function MyComponent() {
  const { openDialog, closeDialog } = useDialog();

  const handleConfirmAction = () => {
    openDialog({
      title: 'Confirm Action',
      children: 'Are you sure you want to proceed?',
      severity: 'warning',
      confirmText: 'Proceed',
      cancelText: 'Cancel',
      resolve: (confirmed: boolean) => {
        if (confirmed) {
          performAction();
        }
        closeDialog();
      },
    });
  };

  return <button onClick={handleConfirmAction}>Perform Action</button>;
}
```

### useModal Hook

```tsx
import { useModal } from '@rytass/cms-react-components';

function MyComponent() {
  const { openModal, closeModal, isOpen } = useModal();

  const handleOpenCustomModal = () => {
    openModal({
      component: CustomModal,
      props: {
        title: 'Custom Modal',
        data: someData,
        onSave: (result) => {
          handleSave(result);
          closeModal();
        },
        onCancel: closeModal,
      },
    });
  };

  return (
    <div>
      <button onClick={handleOpenCustomModal}>Open Modal</button>
      {isOpen && <div>Modal is open</div>}
    </div>
  );
}
```

## Styling and Theming

### Using Mezzanine UI Theme

```tsx
import { MezzanineProvider, createTheme } from '@mezzanine-ui/react';
import { StandardCMSTable } from '@rytass/cms-react-components';

const customTheme = createTheme({
  palette: {
    primary: '#1976d2',
    secondary: '#dc004e',
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function ThemedApp() {
  return (
    <MezzanineProvider theme={customTheme}>
      <StandardCMSTable {...tableProps} />
    </MezzanineProvider>
  );
}
```

### Custom Styling

```scss
// custom-cms-styles.scss
@import '@mezzanine-ui/core/styles';

.custom-cms-table {
  .mzn-table {
    &__header {
      background-color: var(--mzn-color-surface-variant);
    }

    &__row {
      &:hover {
        background-color: var(--mzn-color-action-hover);
      }
    }
  }
}

.custom-form-actions {
  .mzn-button-group {
    gap: 8px;
    
    .mzn-button {
      min-width: 120px;
    }
  }
}
```

## TypeScript Support

### Type Definitions

```tsx
import {
  StandardCMSTableProps,
  StandardCMSFormActionsProps,
  ArticleStage,
  ArticleTableActions,
  ArticlesPermissions,
  LogEntry,
  DialogConfigType,
  ModalConfigType,
} from '@rytass/cms-react-components';

// Custom article type
interface CustomArticle {
  id: string;
  title: string;
  content: string;
  stage: ArticleStage;
  author: {
    id: string;
    name: string;
    email: string;
  };
  categories: string[];
  tags: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

// Table props with custom type
const tableProps: StandardCMSTableProps<CustomArticle> = {
  columns: [...],
  dataSource: articles,
  loading: false,
  // ... other props
};

// Form props with validation
interface ArticleFormData {
  title: string;
  content: string;
  categoryId: string;
}

const formProps: StandardCMSFormActionsProps<ArticleFormData> = {
  form: useForm<ArticleFormData>(),
  stage: ArticleStage.DRAFT,
  permissions: userPermissions,
  // ... other props
};
```

## Best Practices

### Performance Optimization

```tsx
import React, { useMemo, useCallback } from 'react';
import { StandardCMSTable } from '@rytass/cms-react-components';

function OptimizedTable() {
  // Memoize columns to prevent re-renders
  const columns = useMemo(() => [
    { title: 'Title', dataIndex: 'title', width: 300 },
    { title: 'Author', dataIndex: 'author', width: 150 },
    // ... more columns
  ], []);

  // Use callback for action handlers
  const handleAction = useCallback((action: string, record: any) => {
    // Handle action
  }, []);

  // Virtual scrolling for large datasets
  return (
    <StandardCMSTable
      columns={columns}
      dataSource={data}
      onAction={handleAction}
      virtual
      rowHeight={48}
      visibleRows={20}
    />
  );
}
```

### Error Handling

```tsx
import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { StandardCMSFormActions } from '@rytass/cms-react-components';

function FormWithErrorHandling() {
  const handleError = (error: Error) => {
    console.error('Form error:', error);
    showErrorNotification(error.message);
  };

  return (
    <ErrorBoundary
      fallback={<ErrorFallback />}
      onError={handleError}
    >
      <StandardCMSFormActions
        {...formProps}
        onError={handleError}
      />
    </ErrorBoundary>
  );
}
```

### Accessibility

```tsx
import { StandardCMSTable } from '@rytass/cms-react-components';

function AccessibleTable() {
  return (
    <StandardCMSTable
      {...tableProps}
      ariaLabel="Articles management table"
      ariaDescribedBy="table-description"
      rowAriaLabel={(record) => `Article: ${record.title}`}
      actionAriaLabels={{
        edit: 'Edit article',
        delete: 'Delete article',
        publish: 'Publish article',
      }}
    />
  );
}
```

## Testing

### Component Testing

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StandardCMSTable } from '@rytass/cms-react-components';

describe('StandardCMSTable', () => {
  const mockData = [
    { id: '1', title: 'Article 1', stage: 'DRAFT' },
    { id: '2', title: 'Article 2', stage: 'PUBLISHED' },
  ];

  it('renders table with data', () => {
    render(
      <StandardCMSTable
        columns={columns}
        dataSource={mockData}
        rowKey="id"
      />
    );

    expect(screen.getByText('Article 1')).toBeInTheDocument();
    expect(screen.getByText('Article 2')).toBeInTheDocument();
  });

  it('handles row actions', async () => {
    const handleAction = jest.fn();

    render(
      <StandardCMSTable
        columns={columns}
        dataSource={mockData}
        onAction={handleAction}
        rowKey="id"
      />
    );

    const editButton = screen.getByLabelText('Edit article 1');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(handleAction).toHaveBeenCalledWith('edit', mockData[0]);
    });
  });
});
```

### Hook Testing

```tsx
import { renderHook, act } from '@testing-library/react-hooks';
import { useDialog } from '@rytass/cms-react-components';

describe('useDialog', () => {
  it('opens and closes dialog', () => {
    const { result } = renderHook(() => useDialog());

    act(() => {
      result.current.openDialog({
        title: 'Test Dialog',
        children: 'Test content',
      });
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeDialog();
    });

    expect(result.current.isOpen).toBe(false);
  });
});
```

## Migration Guide

### From Legacy Components

```tsx
// Before (legacy)
import { Table, Form, Modal } from 'legacy-cms-components';

// After (new)
import { 
  StandardCMSTable,
  StandardCMSFormActions,
  useModal 
} from '@rytass/cms-react-components';

// Update table props
const legacyTableProps = {
  data: articles,
  columns: columnConfig,
  onRowClick: handleClick,
};

const newTableProps = {
  dataSource: articles,
  columns: columnConfig,
  onAction: (action, record) => {
    if (action === 'view') handleClick(record);
  },
};
```

## Troubleshooting

### Common Issues

1. **Modal not opening**: Ensure ModalProvider is wrapping your component
2. **Form validation not working**: Check react-hook-form registration
3. **Permissions not applying**: Verify permission array format
4. **Table not rendering**: Check dataSource and column configuration

### Debug Mode

```tsx
import { StandardCMSTable } from '@rytass/cms-react-components';

// Enable debug mode for detailed logging
<StandardCMSTable
  {...tableProps}
  debug
  onDebugLog={(log) => console.log('Table debug:', log)}
/>
```

## License

MIT