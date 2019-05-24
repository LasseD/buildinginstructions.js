# buildinginstructions.js

Render LEGO building instructions in the browser using [three.js](https://github.com/mrdoob/three.js) and the [LDraw parts library](http://www.ldraw.org).

See this project visualized on [BrickHub.org](https://brickhub.org)

![Sample image of a building instructions step generated on the fly using buildinginstructions.js](https://brickhub.org/i/data/431/431.png)

## How To Install Locally

After copying the files in this repository, you can view sample_view.htm for how to set up a render. This sample is less than 100 lines and provides a good starting point that is easy to grasp.

See sample_instructions.htm for how to set up building instructions, including options for personalization. This is a very involved sample file reflecting the instructions on BrickHub.org.

If you want to view additional models, then add the necessary LDraw files directly to the 'ldraw_parts' directory. Downloaded files from [the LDraw parts library](http://www.ldraw.org/parts/latest-parts.html) should thus result in a file structure as follows:


* /ldraw_parts - Contains all parts from '/p' and '/parts', such as '1.dat' and '1-4cylc3.dat'.

* /ldraw_parts/8 - Place the content of '/p/8' here.

* /ldraw_parts/48 - Place the content of '/p/48' here.

* /ldraw_parts/s - Place the content of '/parts/s', such as '10s01.dat' here.


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

- Become a valuable addition to the LDraw suite of applications.

## License

buildinginstructions.js is in the Public Domain. 

The LDraw library is redistributable under CCAL version 2.0 : see CAreadme.txt.

Three.js and OrbitControls.js use the MIT license.