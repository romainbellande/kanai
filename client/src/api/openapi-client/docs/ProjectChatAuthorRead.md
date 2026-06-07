
# ProjectChatAuthorRead

Small author payload embedded in chat messages.

## Properties

Name | Type
------------ | -------------
`id` | string
`displayName` | string
`initials` | string
`deleted` | boolean

## Example

```typescript
import type { ProjectChatAuthorRead } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "displayName": null,
  "initials": null,
  "deleted": null,
} satisfies ProjectChatAuthorRead

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectChatAuthorRead
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


