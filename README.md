# ViteSakuga

Cloning a mvp of sakugabooru but with mainly typescript and good libs

- [x] fix build and start errors
- [x] fix vite serve
- [x] transfer data from loaders to query
- [x] better .env handling (crash if not defined and use zod to validate)
- [x] fix build with rolldown
- [x] check cursor db implementation
- [x] manage account page
- [x] add comments to posts
- [x] modify posts
- [x] add preview image to post
- [ ] better ui
- [ ] scroll restoration from post to back to posts list

## Secondary

- [ ] add more data to posts (author)
- [x] add tags to posts
- [ ] add search filters
- [ ] ? add post ranking
- [x] use kyselyfy from drizzle to cleanup database types
- [ ] ffprobe information `ffprobe -v quiet -print_format json -show_format -show_streams /path/video.mp4`
