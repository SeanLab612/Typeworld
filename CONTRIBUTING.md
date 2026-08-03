# Contributing

Thanks for helping improve Typeworld.

## Development

1. Fork the repository and create a focused branch.
2. Install dependencies with `npm ci`.
3. Keep changes scoped and add regression tests where practical.
4. Run `npm test`, `npm run typecheck`, and `npm run build`.
5. Describe visual changes separately from automated verification.

## Mechanical asset contract

Interactive keys, typebars, carriage, platen, return lever, drawers, and books
must remain independently addressable. Do not merge moving parts merely to
reduce node count. Stable node names and pivots are validated by the scripts in
this repository.

The reference image describes a fictional visual direction. Contributions must
not claim that Typeworld is an engineering-accurate replica of a real machine.

## Assets

Do not contribute models, textures, fonts, images, music, or sounds without a
clear license that permits redistribution in this public repository. Add the
source, author, license, modifications, and purpose to
`docs/ASSET-LICENSES.md`.

By submitting a contribution, you agree that code contributions are provided
under MIT and original asset contributions under CC BY 4.0 unless a pull
request explicitly identifies a compatible third-party license.
