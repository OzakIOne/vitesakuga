# ViteSakuga

Cloning a mvp of sakugabooru but with mainly typescript and good libs

- [ ] fix upload failing if user doesnt generate a thumbnail
- [ ] virtualize posts of other pages than /posts so /user/id /tags/tag and make component of rendered list to avoid code duplication
- [ ] fix virtualize .window error
- [ ] maybe change search behavior, if we are in user route then search should search for users and not go back to default posts route?
- [ ] add some toasts to forms / mutations for success / errors
- [ ] make a card component for displaying a single post in a list
- [ ] avoid code duplication in the filter thing 
- [ ] move everything to query instead of router loader
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

- [x] add tags to posts
- [ ] add search filters
- [ ] ? add post ranking
- [x] use kyselyfy from drizzle to cleanup database types
- [ ] ffprobe information `ffprobe -v quiet -print_format json -show_format -show_streams /path/video.mp4`
