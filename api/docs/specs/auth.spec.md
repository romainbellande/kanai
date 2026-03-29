# Authentication spec

* Implement authentication middleware thanks to joserfc lib.
* The middleware must obtain the jwks data in the process of authorization header (bearer token) validation.
* implement proper error handling by raising custom HTTPException (https://fastapi.tiangolo.com/tutorial/handling-errors/?h=#import-httpexception)

## Cache metadata

You must cache discovery endpoint data end jwks data thanks to cachetools library:

```python
from cachetools import cached, TTLCache

@cached(cache=TTLCache(maxsize=1024, ttl=3600))
def method()
...
```

## Implement SessionService

Implement a SessionSession which reuse existing RedisService instance.