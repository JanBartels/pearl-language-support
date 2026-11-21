#ifdef MODE
TYPE EnabledType FIXED;
#else
TYPE DisabledType FLOAT;
#endif
#ifndef MODE
TYPE NotEnabledType FLOAT;
#else
TYPE NotDisabledType FIXED;
#endif
