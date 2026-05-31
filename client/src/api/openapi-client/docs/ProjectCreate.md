
# ProjectCreate

Defines the payload for creating a project.  Attributes:     name: Project display name.     code: Three-character project code using uppercase letters or digits.     priority: Project priority label.     description: Optional project description. Defaults to None.     status: Optional project status label. Defaults to None.     owner_ids: User IDs assigned as project owners. Defaults to an empty list.     member_ids: User IDs assigned as project members. Defaults to an empty list.

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
import type { ProjectCreate } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "code": null,
  "priority": null,
  "description": null,
  "status": null,
  "ownerIds": null,
  "memberIds": null,
} satisfies ProjectCreate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectCreate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


