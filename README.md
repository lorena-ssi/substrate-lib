# substrate-lib

`substrate-lib` is an api for Substrate used in `Lorena SSI`.

[![Build Status](https://travis-ci.com/lorena-ssi/substrate-lib.svg?branch=master)](https://travis-ci.com/lorena-ssi/substrate-lib)
[![Coverage Status](https://coveralls.io/repos/github/lorena-ssi/substrate-lib/badge.svg?branch=master)](https://coveralls.io/github/lorena-ssi/substrate-lib?branch=master)

## Installation

```bash
npm @lorena-ssi/substrate-lib
```

## Getting Started

TODO

```javascript
const Substrate = require('@lorena-ssi/lorena-substrate')
// Creating class Substrate with parameter `url`
const substrate = new Blockchain()
}
```

## Environment variables

In order to create a connection with a non-localhost blockchain an `.env` file must be created with the following variable definition:

```env
SERVER_SUBSTRATE=wss://your.own.substrate.com/
```
