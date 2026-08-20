# Asset ledger

P0 uses code-drawn CSS and Phaser primitives for gameplay plus the following
locally bundled title-screen assets.

| File                                     | Source                                                                               | License / permission                                                               | Author        | Retrieved  | Edits                                          | Production status |
| ---------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------- | ---------- | ---------------------------------------------- | ----------------- |
| `title/tower-of-the-end.png`             | User-provided `references images/타이틀2.png`                                        | Supplied by the user for this project; provenance must be confirmed before release | User-provided | 2026-08-21 | Renamed copy only                              | prototype-only    |
| `fonts/song-myung/SongMyung-Regular.ttf` | [Google Fonts / Song Myung](https://github.com/google/fonts/tree/main/ofl/songmyung) | SIL Open Font License 1.1; bundled as `OFL.txt`                                    | Kim Dong Kwan | 2026-08-21 | None                                           | cleared           |
| `fonts/cinzel/Cinzel-Variable.ttf`       | [Google Fonts / Cinzel](https://github.com/google/fonts/tree/main/ofl/cinzel)        | SIL Open Font License 1.1; bundled as `OFL.txt`                                    | Natanael Gama | 2026-08-21 | Renamed download only                          | cleared           |
| `loadout/weapons/*.png`                  | User-provided weapon reference images                                                | Supplied by the user; provenance must be confirmed before release                  | User-provided | 2026-08-21 | Renamed copies only                            | prototype-only    |
| `loadout/characters/ern-base.png`        | User-provided `references images/기초캐릭.png`                                       | Supplied by the user; provenance must be confirmed before release                  | User-provided | 2026-08-21 | Renamed copy only                              | prototype-only    |
| `loadout/characters/ern-{weapon}.png`    | OpenAI built-in image generation using the supplied character and weapon references  | Generated for this project; release clearance follows the supplied source images   | OpenAI        | 2026-08-21 | Five equipment variants with transparent alpha | prototype-only    |

When adding an asset, record:

| Field               | Required value                       |
| ------------------- | ------------------------------------ |
| File                | Repository-relative path             |
| Source              | Original page or generation tool     |
| License             | Exact license or permission evidence |
| Author/model        | Creator or generation model          |
| Prompt/reference    | Required for generated assets        |
| Retrieved/generated | ISO date                             |
| Edits               | Crop, recolor, frame cleanup, etc.   |
| Production status   | prototype-only / cleared             |
