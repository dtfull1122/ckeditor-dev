/* bender-tags: editor,widget */
/* bender-ckeditor-plugins: easyimage,toolbar,contextmenu,undo */
/* bender-include: _helpers/tools.js */
/* global easyImageTools */

( function() {
	'use strict';

	bender.editors = {
		classic: {},

		divarea: {
			config: {
				extraPlugins: 'divarea'
			}
		},

		inline: {
			creator: 'inline'
		}
	};

	// Force Edge to run every test in new CKEditor's instance.
	function createTestsForEditors( editors, tests ) {
		var generatedTests = {},
			test,
			i = 0;

		function generateTest( name ) {
			CKEDITOR.tools.array.forEach( editors, function( editor ) {
				var options = CKEDITOR.tools.object.merge( bender.editors[ editor ], {
					name: editor + i++
				} );

				generatedTests[ name + ' (' + editor + ')' ] = function() {
					bender.editorBot.create( options, function( bot ) {
						tests[ name ]( bot.editor, bot );
					} );
				};
			} );
		}

		if ( !CKEDITOR.env.edge ) {
			return bender.tools.createTestsForEditors( CKEDITOR.tools.objectKeys( bender.editors ), tests );
		}

		for ( test in tests ) {
			if ( test.indexOf( 'test' ) === 0 ) {
				generateTest( test );
			}
		}

		return generatedTests;
	}

	function assertMenuItemsState( items, asserts ) {
		CKEDITOR.tools.array.forEach( items, function( item ) {
			if ( asserts[ item.command ] ) {
				assert.areSame( asserts[ item.command ], item.state,
					'Menu item ' + item.command + ' has appropriate state' );
			}
		} );
	}

	var originalGetClientRect = CKEDITOR.dom.element.prototype.getClientRect,
		widgetHtml = '<figure class="image easyimage"><img src="../image2/_assets/foo.png" alt="foo"><figcaption>Test image</figcaption></figure>',
		sideWidgetHtml = '<figure class="image easyimage easyimage-side"><img src="../image2/_assets/foo.png" alt="foo"><figcaption>Test image</figcaption></figure>',
		tests = {
			setUp: function() {
				if ( CKEDITOR.env.ie ) {
					CKEDITOR.dom.element.prototype.getClientRect = function() {
						return {
							width: 0,
							height: 0,
							left: 0,
							top: 0
						};
					};
				}
			},

			tearDown: function() {
				var currentDialog = CKEDITOR.dialog.getCurrent();

				if ( currentDialog ) {
					currentDialog.hide();
				}

				if ( CKEDITOR.env.ie ) {
					CKEDITOR.dom.element.prototype.getClientRect = originalGetClientRect;
				}
			},

			'test commands are enabled only on widget': function( editor, bot ) {
				bot.setData( widgetHtml, function() {
					var widget = editor.widgets.getByElement( editor.editable().findOne( 'figure' ) );

					easyImageTools.assertCommandsState( editor, {
						easyimageFull: CKEDITOR.TRISTATE_DISABLED,
						easyimageSide: CKEDITOR.TRISTATE_DISABLED,
						easyimageAlt: CKEDITOR.TRISTATE_DISABLED
					} );

					widget.focus();

					easyImageTools.assertCommandsState( editor, {
						easyimageFull: CKEDITOR.TRISTATE_ON,
						easyimageSide: CKEDITOR.TRISTATE_OFF,
						easyimageAlt: CKEDITOR.TRISTATE_OFF
					} );
				} );
			},

			'test easyimageAlt command': function( editor, bot ) {
				bot.setData( widgetHtml, function() {
					var widget = editor.widgets.getByElement( editor.editable().findOne( 'figure' ) );

					editor.once( 'dialogShow', function( evt ) {
						resume( function() {
							var dialog = evt.data;

							assert.areSame( 'foo', dialog.getValueOf( 'info', 'txtAlt' ),
								'Initial value is fetched from image' );

							dialog.setValueOf( 'info', 'txtAlt', 'bar' );
							dialog.getButton( 'ok' ).click();

							assert.areSame( 'bar', editor.editable().findOne( 'img' ).getAttribute( 'alt' ),
								'Alt text of image is changed' );
						} );
					} );

					widget.focus();
					editor.execCommand( 'easyimageAlt' );
					wait();
				} );
			},

			'test easyimageFull and easyimageSide commands': function( editor, bot ) {
				bot.setData( widgetHtml, function() {
					var widget = editor.widgets.getByElement( editor.editable().findOne( 'figure' ) );

					widget.focus();

					assert.isFalse( widget.element.hasClass( 'easyimage-side' ), 'Image does not have side class' );
					assert.isTrue( widget.hasClass( 'easyimage' ), 'Widget wrapper has main class' );
					assert.isFalse( widget.hasClass( 'easyimage-side' ),
						'Widget wrapper does not have side class' );
					assert.areSame( 'full', widget.data.type, 'Widget has correct type data' );

					bot.contextmenu( function( menu ) {
						assertMenuItemsState( menu.items, {
							easyimageFull: CKEDITOR.TRISTATE_ON,
							easyimageSide: CKEDITOR.TRISTATE_OFF
						} );

						editor.execCommand( 'easyimageSide' );

						assert.isTrue( widget.element.hasClass( 'easyimage-side' ), 'Image has side class' );
						assert.isTrue( widget.hasClass( 'easyimage' ), 'Widget wrapper has main class' );
						assert.isTrue( widget.hasClass( 'easyimage-side' ), 'Widget wrapper has side class' );
						assert.areSame( 'side', widget.data.type, 'Widget has correct type data' );

						bot.contextmenu( function( menu ) {
							assertMenuItemsState( menu.items, {
								easyimageFull: CKEDITOR.TRISTATE_OFF,
								easyimageSide: CKEDITOR.TRISTATE_ON
							} );

							menu.hide();
						} );
					} );
				} );
			},

			'test initial type data for side image': function( editor, bot ) {
				bot.setData( sideWidgetHtml, function() {
					var widget = editor.widgets.getByElement( editor.editable().findOne( 'figure' ) );

					assert.areSame( 'side', widget.data.type, 'Widget has correct type data' );
				} );
			}
		};

	tests = createTestsForEditors( CKEDITOR.tools.objectKeys( bender.editors ), tests );
	bender.test( tests );
} )();
