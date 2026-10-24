# Architecture v2 — Data first

## Authority
The previous RPG runtime is a **behavioral reference / external specification**.
It is **not** the architectural source of truth for new development.
Preserve observable gameplay (movement, entry/exit, combat, shopping, NPC dialogue,
lighting, saved games) during migration, but do not reproduce its class structure.

## Data graph
Area > building > layout (floor/room) > objects (including actors) > role keys.
A single entity can have multiple roles. Example:
```js
{
 id:'shop-counter',
 type:'furniture',
 model:'counter',
 position:[0,0,-3],
 roles:['inspectable'],
 serviceKey:'weapons'
}
```

## Executable boundary
* The authored inputs live in src/starter-town.js, src/interior-scenes.js,
  src/entity-roles.js, src/game-content.js and src/gameplay-rules.js.
* Stateless domain processors accept plain data and output state, intent and effects.
* Render adapters only interpret model keys and the output of processors.
* View or engine classes must not be used as permanent storage for authored game rules.
* Gameplay content changes should require a data edit, not a new per-building class.
* Data-driven tests assert public data contracts rather than historical class names.

## Transition discipline
The running Three.js legacy adapter stays in place until replaced by an
equivalent data-driven adapter and validated on device. No mass deletion while
the new behaviors have not been tested. Old tests can be run separately using
`npm run test:legacy`. CI runs `npm run test:all` instead.

## Acceptance criteria
Every generated entity has a stable key and an explicit parent; roles resolve
from the role catalog; actions are interpreted by key; scene assembly reads the
same layout/object data as collisions and interactions. Renderer swap must not
change semantic state. An area can be authored without modifying runtime classes.
