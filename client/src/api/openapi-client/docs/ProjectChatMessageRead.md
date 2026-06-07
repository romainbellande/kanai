
# ProjectChatMessageRead

Project chat history message response payload.

## Properties

Name | Type
------------ | -------------
`id` | string
`projectId` | string
`body` | string
`createdAt` | Date
`author` | [ProjectChatAuthorRead](ProjectChatAuthorRead.md)

## Example

```typescript
import type { ProjectChatMessageRead } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "projectId": null,
  "body": null,
  "createdAt": null,
  "author": null,
} satisfies ProjectChatMessageRead

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectChatMessageRead
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


