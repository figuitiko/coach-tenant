# Domain modules

The modular monolith is organized around `identity`, `tenancy`, `training`, and `progress`.
Each module will own its application, domain, and infrastructure boundaries as behavior is added.
Shared domain concepts belong in `shared/domain`; reusable presentation primitives belong in
`components/ui`. UI routes must call module application APIs rather than persistence adapters.
