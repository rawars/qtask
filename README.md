# QTask

Simple yet powerful group queue library built on top of Redis.

## Features

- Group-based task queuing
- Priority support
- Multiple consumers
- Redis-backed persistence
- Colored logging with pino
- Support for both ESM and CommonJS

## Installation

```bash
npm install @fazpi-ai/qtask
```

## Usage

```javascript
// ESM
import { RedisManager, Subscriber } from '@fazpi-ai/qtask';

// CommonJS
const { RedisManager, Subscriber } = require('@fazpi-ai/qtask');
```

Check the `examples` directory for complete usage examples.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

Copyright (C) 2024 Rafael Jose Garcia Suarez and contributors.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
