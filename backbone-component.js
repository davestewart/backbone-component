// Backbone.Component
// ==================
//
// A thin layer on top of Backbone's view class to add nested child views.

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'Backbone'], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(require('underscore', 'Backbone'));
  } else {
    factory(root._, root.Backbone);
  }
})(this, function (_, Backbone) {

  var isIE = (function() {
    // MSIE < 11
    if (document.all) {
      return true;
    }
    // MSIE 11
    return (!(window.ActiveXObject) && 'ActiveXObject' in window);
  })();

  Backbone.Component = Backbone.View.extend({

    // Override constructor so Components can use `initialize` normally.
    constructor: function(options) {
      this._setup();

      // Remove undefined options.
      _.each(options, function(v, k) {
        if (typeof v === 'undefined') {
          delete options[k];
        }
      });
      // Extend with defaults.
      options = _.extend({}, _.result(this, 'defaults'), options);

      Backbone.View.call(this, options);

    },

    // Public API
    // ----------

    // Add a child view to the end of the element.
    // Optionally specify a selector within the view to attach to.
    // Aliased to `add`.
    append: function(view, selector) {
      this._addChild(view, selector, 'append');
      return this;
    },

    // Add a child view to the beginning of the view's element.
    // Optionally specify a selector within the view to attach to.
    prepend: function(view, selector) {
      this._addChild(view, selector, 'prepend');
      return this;
    },

    // Retrieve the list of child views.
    children: function() {
      return _.pluck(this._children, 'view');
    },

    // Remove all child views added to this one.
    empty: function() {
      this._removeChildren();
      return this;
    },

    // Render the existing template with the provided data.
    renderTemplate: function(data) {
      this.$el.html(this._compile(this.template)(data || {}));
      return this;
    },

    // Wraps `_.template`. Can be replaced by any object that responds to
    // `compile` and returns a compiled template function.
    renderer: {
      compile: function(template) {
        this._template = this._template || _.partial(_.template, template);
        return this._template;
      }
    },

    // Private methods
    // ---------------

    // Initial setup. Create new child array, and wrap `render` and `remove`
    // methods.
    _setup: function() {
      // Mixin renderer to view instance, so that compiled templates aren't
      // shared.
      _.extend(this, { _compile: this.renderer.compile });

      this._children = [];
      this.render = this._wrapRender();
      this.remove = this._wrapRemove();
    },

    // Add a child view to an internal array, keeping a reference to the element
    // and attach method it should use.
    _addChild: function(view, selector, method) {
      var child = { view: view, selector: selector, method: method || 'append' };

      // Assign a method to the child so it can remove itself from `_children`
      // array when it's removed.
      // Written as an anonymous function to prevent it being bound multiple times
      // in grandparent-parent-child situations.
      var removeFromParent = function(child) {
        this._children = _.without(this._children, child);
      };
      view._removeFromParent = _.bind(removeFromParent, this, child);

      this._children.push(child);
    },

    // Call `remove` for each child added to the view.
    _removeChildren: function() {
      _.invoke(this.children(), 'remove');
      this._children = [];
    },

    // Replaced by a function scoped to the parent if the component is added as a
    // child (in `_addChild`) but otherwise does nothing (as the component
    // wouldn't have a parent).
    _removeFromParent: function() {
    },

    // Wrap `render` to automatically attach all children.
    _wrapRender: function() {
      var wrapper = function(render) {
        var args = _.rest(arguments);

        if (isIE) {
          this._detachChildren();
        }
        render.apply(this, args);
        this._attachChildren();

        return Backbone.Component.prototype.render.apply(this, args);
      };

      var originalRender = _.bind(this.render, this);
      return _.wrap(originalRender, wrapper);
    },

    // Wrap `remove` to automatically remove all children and itself from its
    // parent.
    _wrapRemove: function() {
      var wrapper = function(remove) {
        var args = _.rest(arguments);

        this._removeFromParent();
        this._removeChildren();
        remove.apply(this, args);

        return Backbone.Component.prototype.remove.apply(this, args);
      };

      var originalRemove = _.bind(this.remove, this);
      return _.wrap(originalRemove, wrapper);
    },

    // Attach child to the correct element and with the correct method. Defaults
    // to `this.$el` and `append`.
    // Only call `render` on the child the first time.
    _attachChild: function(child) {
      var target = child.selector ? this.$(child.selector) : this.$el;
      if (!child.rendered) {
        child.view.render();
        child.rendered = true;
      }
      target[child.method](child.view.$el);
    },

    // Attach all children in the right order, and call `delegateEvents` for each
    // child view so handlers are correctly bound after being attached.
    _attachChildren: function() {
      _.each(this._children, function(child) {
        this._attachChild(child);
        child.view.delegateEvents();
      }, this);
    },

    // Detach children to avoid this bug in IE:
    // http://bugs.jquery.com/ticket/11473
    _detachChildren: function() {
      _.each(this._children, function(child) {
        if (child.view.$el) {
          child.view.$el.detach();
        }
      });
    }

  });

  // Alias `add` to `append`.
  Backbone.Component.prototype.add = Backbone.Component.prototype.append;

  return Backbone.Component;

});
