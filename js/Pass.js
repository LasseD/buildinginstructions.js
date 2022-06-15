/*import {
    OrthographicCamera,
        PlaneBufferGeometry,
        Mesh
        } from "../../../build/three.module.js";*/

THREE.Pass = function() {

    // if set to true, the pass is processed by the composer
    this.enabled = true;

    // if set to true, the pass indicates to swap read and write buffer after rendering
    this.needsSwap = true;

    // if set to true, the pass clears its buffer before rendering
    this.clear = false;

    // if set to true, the result of the pass is rendered to screen. This is set automatically by EffectComposer.
    this.renderToScreen = false;

}

Object.assign( THREE.Pass.prototype, {

        setSize: function ( /* width, height */ ) {},

            render: function ( /* renderer, writeBuffer, readBuffer, deltaTime, maskActive */ ) {

            console.error( 'THREE.Pass: .render() must be implemented in derived pass.' );

        }

    } );

// Helper for passes that need to fill the viewport with a single quad.

THREE.Pass.FullScreenQuad = ( function () {
    let camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
    
    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ - 1, 3, 0, - 1, - 1, 0, 3, - 1, 0 ], 3 ) );
    geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( [ 0, 2, 0, 0, 2, 0 ], 2 ) );


        let FullScreenQuad = function ( material ) {

            this._mesh = new THREE.Mesh( geometry, material );

        };

        Object.defineProperty( FullScreenQuad.prototype, 'material', {

                get: function () {

                    return this._mesh.material;

                },

                    set: function ( value ) {

                    this._mesh.material = value;

                }

            } );

        Object.assign( FullScreenQuad.prototype, {

                dispose: function () {

                    this._mesh.geometry.dispose();

                },

                    render: function ( renderer ) {

                    renderer.render( this._mesh, camera );

                }

            } );

        return FullScreenQuad;

    } )();

//export { Pass };
