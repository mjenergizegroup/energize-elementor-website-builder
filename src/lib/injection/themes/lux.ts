import { BaseThemeInjector } from "../base";

// Lux injector. The _meta slot map is pending port (status: pending-port), so
// injection currently throws via BaseThemeInjector.ready. Lux uses three heading
// widget types (jkit_heading, elementskit-heading, gum_heading); these are all
// expressible in _meta as plain field writes, so no override is expected here.
export class LuxInjector extends BaseThemeInjector {}
