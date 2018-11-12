# buildinginstructions.js

Render LEGO building instructions in the browser using [three.js](https://github.com/mrdoob/three.js/?PHPSESSID=3d110c25f9ee23ac1642f6f238ba357e) and the [LDraw parts library](http://www.ldraw.org).

See this project visualized on [BrickHub.org](https://brickhub.org)

![Sample image of a model generated using buildinginstructions.js](https://brickhub.org/i/data/14/14.png)

## How To Install Locally

After copying the files in this repository, you can view sample_view.htm for seeing how to set up a render. 

See sample_instructions.htm for how to set up building instructions, including options for personalization.

These files fetch data asynchroneously, so opening them in your browser might not work out of the box due to default security settings. To get around this you can either host the files on a local server or disable the browser checks. As an example, Chrome can be started with the following parameters in order to disable these security settings:

```
 --disable-web-security --user-data-dir=some_directory_where_it_is_ok_that_chrome_saves_a_lot_of_files
```

Feel free to raise issues or make pull requests. The project is in active development.

## Vision

- Generate LEGO building instructions quickly in any web browser.

- Automatically modify LEGO building instructions to make the LEGO models easier to build.

- Contribute to a fun user experience for LEGO builders of all ages.

- Reduce paper waste by replacing the need of traditional building instructions.

- Improve the LDraw parts library by fixing BFC issues.

- Supplement the LDraw parts library with open source connectivity information for parts.

## License

buildinginstructions.js is in the Public Domain. 

The LDraw library is redistributable under CCAL version 2.0 : see CAreadme.txt.

Three.js uses the MIT license.