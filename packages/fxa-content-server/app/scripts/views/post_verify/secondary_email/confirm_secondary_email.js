/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 *
 */
import Cocktail from 'cocktail';
import FormView from './form';
import Template from 'templates/post_verify/add_secondary_email.mustache';

class ConfirmSecondaryEmail extends FormView {
  template = Template;

  beforeRender() {}

  afterRender() {}

  setInitialContext(context) {}
}

Cocktail.mixin();

export default ConfirmSecondaryEmail;
