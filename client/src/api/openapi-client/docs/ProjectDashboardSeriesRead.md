
# ProjectDashboardSeriesRead

One chart-ready dashboard series.

## Properties

Name | Type
------------ | -------------
`name` | string
`entries` | [Array&lt;ProjectDashboardCardEntryRead&gt;](ProjectDashboardCardEntryRead.md)

## Example

```typescript
import type { ProjectDashboardSeriesRead } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "entries": null,
} satisfies ProjectDashboardSeriesRead

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectDashboardSeriesRead
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


