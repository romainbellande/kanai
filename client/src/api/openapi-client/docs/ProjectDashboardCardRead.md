
# ProjectDashboardCardRead

One supported Project Dashboard chart card.

## Properties

Name | Type
------------ | -------------
`key` | string
`title` | string
`series` | [Array&lt;ProjectDashboardSeriesRead&gt;](ProjectDashboardSeriesRead.md)
`entries` | [Array&lt;ProjectDashboardCardEntryRead&gt;](ProjectDashboardCardEntryRead.md)
`emptyState` | [ProjectDashboardCardEmptyStateRead](ProjectDashboardCardEmptyStateRead.md)

## Example

```typescript
import type { ProjectDashboardCardRead } from ''

// TODO: Update the object below with actual values
const example = {
  "key": null,
  "title": null,
  "series": null,
  "entries": null,
  "emptyState": null,
} satisfies ProjectDashboardCardRead

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectDashboardCardRead
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


