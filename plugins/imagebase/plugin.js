/**
 * @license Copyright (c) 2003-2017, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or http://ckeditor.com/license
 */

( function() {
	'use strict';

	var stylesLoaded = false;

	function loadStyles( editor, plugin ) {
		if ( !stylesLoaded ) {
			CKEDITOR.document.appendStyleSheet( plugin.path + 'styles/imagebase.css' );
			stylesLoaded = true;
		}

		if ( editor.addContentsCss ) {
			editor.addContentsCss( plugin.path + 'styles/imagebase.css' );
		}
	}

	function getFocusedWidget( editor ) {
		var widgets = editor.widgets,
			currentActive = editor.focusManager.currentActive;

		if ( widgets.focused ) {
			return widgets.focused;
		}

		if ( currentActive instanceof CKEDITOR.plugins.widget.nestedEditable ) {
			return widgets.getByElement( currentActive );
		}
	}

	function hasWidgetFeature( widget, feature ) {
		return widget.features && CKEDITOR.tools.array.indexOf( widget.features, feature ) !== -1;
	}

	function getLinkFeature() {
		function isLinkable( widget ) {
			return widget && hasWidgetFeature( widget, 'link' );
		}

		function addLinkAttributes( editor, linkElement, linkData ) {
			// Set and remove all attributes associated with this state.
			var attributes = CKEDITOR.plugins.link.getLinkAttributes( editor, linkData );

			if ( !CKEDITOR.tools.isEmpty( attributes.set ) ) {
				linkElement.setAttributes( attributes.set );
			}

			if ( attributes.removed.length ) {
				linkElement.removeAttributes( attributes.removed );
			}
		}

		function createLink( editor, img, linkData ) {
			var link = img.getAscendant( 'a' ) || editor.document.createElement( 'a' );

			addLinkAttributes( editor, link, linkData );

			if ( !link.contains( img ) ) {
				link.replace( img );
				img.move( link );
			}

			return link;
		}

		function getLinkData( widget ) {
			return CKEDITOR.plugins.link.parseLinkAttributes( widget.editor, widget.parts.link );
		}

		function appendMenuItems( editor ) {
			editor.addMenuGroup( 'imagebase', 10 );

			editor.addMenuItem( 'imagebase', {
				label: editor.lang.link.menu,
				command: 'link',
				group: 'imagebase'
			} );
		}

		function createOkListener( evt, dialog, widget ) {
			return function() {
				if ( !isLinkable( widget ) ) {
					return;
				}

				evt.stop();

				var data = {};

				dialog.commitContent( data );
				widget.setData( 'link', data );
			};
		}

		function addUnlinkListener( editor, evtType, callback ) {
			editor.getCommand( 'unlink' ).on( evtType, function( evt ) {
				var widget = getFocusedWidget( editor );

				// Override unlink only when link truly belongs to the widget.
				// If wrapped inline widget in a link, let default unlink work (http://dev.ckeditor.com/ticket/11814).
				if ( !isLinkable( widget ) ) {
					return;
				}

				evt.stop();

				if ( callback && typeof callback === 'function' ) {
					callback( this, widget, editor );
				}

				evt.cancel();
			} );
		}

		return {
			allowedContent: {
				a: {
					attributes: '!href'
				}
			},
			parts: {
				link: 'a'
			},
			init: function() {
				if ( this.editor.plugins.link && this.editor.contextMenu ) {
					this.on( 'contextMenu', function( evt ) {
						if ( this.parts.link ) {
							evt.data.link = evt.data.unlink = CKEDITOR.TRISTATE_OFF;
						}
					} );
				}
			},

			setUp: function( editor ) {
				if ( !editor.plugins.link ) {
					// All of listeners registered later on make only sense when link plugin is loaded.
					return;
				}

				if ( editor.contextMenu ) {
					appendMenuItems( editor );
				}

				editor.on( 'dialogShow', function( evt ) {
					var widget = getFocusedWidget( editor ),
						dialog = evt.data,
						displayTextField,
						okListener;

					if ( !isLinkable( widget ) || dialog._.name !== 'link' ) {
						return;
					}

					displayTextField = dialog.getContentElement( 'info', 'linkDisplayText' ).getElement().getParent().getParent();

					dialog.setupContent( widget.data.link || {} );
					displayTextField.hide();

					// This listener overwrites the default action after pressing "OK" button in link dialog.
					// It gets the user input and set appropriate data in the widget.
					// `evt.stop` and higher priority are necessary to prevent adding unwanted link to
					// widget's caption.
					okListener = dialog.once( 'ok',	createOkListener( evt, dialog, widget ), null, null, 9 );

					dialog.once( 'hide', function() {
						okListener.removeListener();
						displayTextField.show();
					} );
				} );


				// Overwrite default behaviour of unlink command.
				addUnlinkListener( editor, 'exec', function( command, widget, editor ) {
					widget.setData( 'link' , null );
					command.refresh( editor, editor.elementPath() );
				} );

				addUnlinkListener( editor, 'refresh', function( command, widget ) {
					command.setState( widget.parts.link ? CKEDITOR.TRISTATE_OFF : CKEDITOR.TRISTATE_DISABLED );
				} );
			},

			data: function( evt ) {
				var editor = this.editor,
					link = evt.data.link,
					img = this.element.findOne( 'img' );

				// Widget is inited with link, so let's set appropriate data.
				if ( typeof link === 'undefined' && this.parts.link ) {
					this.setData( 'link', getLinkData( this ) );
				}

				if ( typeof link === 'undefined' ) {
					return;
				}

				// Unlink was invoked.
				if ( link === null ) {
					this.parts.link.remove( true );
					this.parts.link = null;

					// Reset link state (#tp3298).
					delete evt.data.link;
				} else {
					this.parts.link = createLink( editor, img, link );
				}
			}
		};
	}

	function getCaptionFeature() {
		function createCaption( widget ) {
			var element = widget.element,
				caption = element.getDocument().createElement( 'figcaption' );

			element.append( caption );
			widget.initEditable( 'caption', widget.definition.editables.caption );

			return caption;
		}

		function isEmptyOrHasPlaceholder( widget ) {
			return !widget.editables.caption.getData() || !!widget.parts.caption.data( 'cke-placeholder' );
		}

		function addPlaceholder( widget ) {
			widget.parts.caption.data( 'cke-placeholder', widget.editor.lang.imagebase.captionPlaceholder );
		}

		function removePlaceholder( widget ) {
			widget.parts.caption.data( 'cke-placeholder', false );
			widget.editables.caption.setData( '' );
		}

		function toggleVisibility( caption, isVisible ) {
			caption.data( 'cke-active', isVisible );
			caption.data( 'cke-hidden', !isVisible );
		}

		return {
			setUp: function( editor ) {
				var listener;

				listener = editor.on( 'selectionChange', function( evt ) {
					var widgets = editor.widgets,
						focused = getFocusedWidget( editor ),
						previous = widgets.getByElement( editor.editable().findOne( 'figcaption[data-cke-active]' ) );

					if ( !editor.filter.check( 'figcaption' ) ) {
						return listener.removeListener();
					}

					if ( focused && hasWidgetFeature( focused, 'caption' ) ) {
						focused._refreshCaption( evt.data.path.lastElement );
					}

					if ( previous && hasWidgetFeature( previous, 'caption' ) ) {
						previous._refreshCaption( evt.data.path.lastElement );
					}
				} );
			},

			init: function() {
				if ( !this.editor.filter.check( 'figcaption' ) ) {
					return;
				}

				if ( !this.parts.caption ) {
					this.parts.caption = createCaption( this );
				}

				this._refreshCaption();
			},

			/**
			 * Method used inside {@link CKEDITOR.editor#event-selectionChange} event to decide if caption for given widget
			 * should be displayed and should contain placeholder text.
			 *
			 * @private
			 * @member CKEDITOR.plugins.imagebase.featuresDefinitions.caption
			 * @param {CKEDITOR.dom.element} sender Element, which triggered `selectionChange` event
			 */
			_refreshCaption: function( sender ) {
				var isFocused = getFocusedWidget( this.editor ) === this,
					caption = this.parts.caption,
					editable = this.editables.caption;

				if ( isFocused ) {
					if ( !editable.getData() && !sender.equals( caption ) ) {
						addPlaceholder( this );
					} else if ( sender.equals( caption ) && sender.data( 'cke-placeholder' ) ) {
						removePlaceholder( this );
					}

					toggleVisibility( caption, true );
				} else if ( isEmptyOrHasPlaceholder( this ) ) {
					removePlaceholder( this );
					toggleVisibility( caption, false );
				}
			}
		};
	}

	var featuresDefinitions = {
		caption: getCaptionFeature(),

		link: getLinkFeature()
	};

	function createWidgetDefinition( editor, definition ) {
		var defaultTemplate = new CKEDITOR.template(
			'<figure>' +
				'<img alt="" src="" />' +
				'<figcaption>{captionPlaceholder}</figcaption>' +
			'</figure>' ),
			baseDefinition;

		/**
		 * This is an abstract class that describes a definition of a basic image widget
		 * created by {@link CKEDITOR.plugins.imagebase#addImageWidget} method.
		 *
		 * Note that because the image widget is a type of a widget, this definition extends
		 * {@link CKEDITOR.plugins.widget.definition}.
		 * It adds several parts of image and implements the basic version of
		 * {@link CKEDITOR.plugins.widget.definition#upcast} callback.
		 *
		 * @abstract
		 * @since 4.8.0
		 * @class CKEDITOR.plugins.imagebase.imageWidgetDefinition
		 * @mixins CKEDITOR.plugins.widget.definition
		 */
		baseDefinition = {
			pathName: editor.lang.imagebase.pathName,

			template: defaultTemplate,

			allowedContent: {
				img: {
					attributes: '!src,alt,width,height'
				},
				figure: true,
				figcaption: true
			},

			requiredContent: 'figure; img[!src]',

			/**
			 * The array containing names of features added to this widget's definition.
			 *
			 * @property {String[]} features
			 */
			features: [],

			editables: {
				caption: {
					selector: 'figcaption',
					pathName: editor.lang.imagebase.pathNameCaption,
					allowedContent: 'br em strong sub sup u s; a[!href,target]'
				}
			},

			parts: {
				image: 'img',
				caption: 'figcaption'
			},

			upcasts: {
				figure: function( element ) {
					if ( element.find( 'img', true ).length === 1 ) {
						return element;
					}
				}
			}
		};

		definition = CKEDITOR.tools.object.merge( baseDefinition, definition );

		/**
		 * Image widget definition overrides {@link CKEDITOR.plugins.widget.definition#upcast} property.
		 * It's automatically set to enumerate keys of {@link #upcasts}.
		 * Avoid changes, unless you know what you're doing.
		 *
		 * @member CKEDITOR.plugins.imagebase.imageWidgetDefinition
		 * @property {String}
		 */
		definition.upcast = CKEDITOR.tools.objectKeys( definition.upcasts ).join( ',' );

		return definition;
	}

	CKEDITOR.plugins.add( 'imagebase', {
		requires: 'widget',
		lang: 'en',

		init: function( editor ) {
			loadStyles( editor, this );
		}
	} );

	/**
	 * Namespace providing a set of helper functions for working with image widgets.
	 *
	 * @since 4.8.0
	 * @singleton
	 * @class CKEDITOR.plugins.imagebase
	 */
	CKEDITOR.plugins.imagebase = {
		/**
		 * Object containing all available features definitions.
		 * @property {Object}
		 */
		featuresDefinitions: featuresDefinitions,

		/**
		 * Registers a new widget based on passed definition.
		 *
		 * @param {CKEDITOR.editor} editor Editor that will get the widget registered.
		 * @param {String} name Widget name.
		 * @param {CKEDITOR.plugins.imagebase.imageWidgetDefinition} definition Widget's definition.
		 */
		addImageWidget: function( editor, name, definition ) {
			var widget = editor.widgets.add( name, createWidgetDefinition( editor, definition ) );

			editor.addFeature( widget );
		},

		/**
		 * Adds new feature to the passed widget's definition by invoking initial setup once for the editor
		 * and extending widget's definition to include all fields needed by this feature.
		 *
		 *		var widgetDefinition = {};
		 *		widgetDefinition = CKEDITOR.plugins.imagebase.addFeature( editor, 'link', widgetDefinition );
		 *		CKEDITOR.plugins.imagebase.addImageWidget( editor, 'myWidget', widgetDefinition );
		 *
		 * @param {CKEDITOR.editor} editor Editor that will get the widget registered.
		 * @param {String} name Feature name.
		 * @param {CKEDITOR.plugins.imagebase.imageWidgetDefinition} definition Widget's definition.
		 * @returns {CKEDITOR.plugins.imagebase.imageWidgetDefinition} Widget's definition extended
		 * with fields needed by feature.
		 */
		addFeature: function( editor, name, definition ) {
			var featureDefinition = CKEDITOR.tools.clone( this.featuresDefinitions[ name ] ),
				ret;

			function mergeMethods( oldOne, newOne ) {
				if ( !oldOne && !newOne ) {
					return;
				}

				return function() {
					oldOne && oldOne.apply( this, arguments );
					newOne && newOne.apply( this, arguments );
				};
			}

			featureDefinition.init = mergeMethods( definition.init, featureDefinition.init );
			featureDefinition.data = mergeMethods( definition.data, featureDefinition.data );

			if ( featureDefinition.setUp ) {
				featureDefinition.setUp( editor, definition );

				delete featureDefinition.setUp;
			}

			ret = CKEDITOR.tools.object.merge( definition, featureDefinition );

			if ( !CKEDITOR.tools.isArray( ret.features ) ) {
				ret.features = [];
			}

			ret.features.push( name );

			return ret;
		}
	};
}() );
