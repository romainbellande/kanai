
# ProjectUpdate

Defines the payload for updating a project.  Attributes:     name: Optional updated project display name. Defaults to None.     code: Optional updated three-character project code using uppercase letters         or digits. Defaults to None.     priority: Optional updated project priority label. Defaults to None.     description: Optional updated project description. Defaults to None.     status: Optional updated project status label. Defaults to None.     owner_ids: Optional replacement list of owner user IDs. Defaults to None.     member_ids: Optional replacement list of member user IDs. Defaults to None.

## Properties

Name | Type
------------ | -------------
`name` | string
`code` | string
`priority` | string
`description` | string
`status` | string
`ownerIds` | Array&lt;string&gt;
`memberIds` | Array&lt;string&gt;

## Example

```typescript
import type { ProjectUpdate } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "code": null,
  "priority": null,
  "description": null,
  "status": null,
  "ownerIds": null,
  "memberIds": null,
} satisfies ProjectUpdate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectUpdate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


