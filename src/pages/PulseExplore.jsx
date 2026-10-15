import { useEffect, useRef, useState } from "react";
import { useOutletContext, useLocation, useNavigate } from "react-router-dom";
import { resolveExploreLink, exploreVideoLocation } from "../features/pulse/videoEngagement";
import { videoDiagnostic } from "../features/pulse/videoDiagnostics";
import { useFeedItems } from "../hooks/useFeedItems";
import PodcastList from "../components/PodcastList";
import DiscoveryRail from "../features/pulse/DiscoveryRail";
import { EXPLORE_CATEGORIES, exploreSections, exploreVideos, scrollDiscoveryLink, exploreModalVideo } from "../features/pulse/exploreContent";
import "../features/pulse/PulseExplore.css";

export default function PulseExplore() {
  const [category, setCategory] = useState("All");
  const [musicExpanded, setMusicExpanded] = useState(false);
  const { discoveryChannels, openVideo, activeVideoId } = useOutletContext();
  const feed = useFeedItems({ limit: 30 });
  const sections = exploreSections(category);
  const location = useLocation();
  const navigate = useNavigate();
  const openedLinkRef = useRef(null);
  const [linkStatus, setLinkStatus] = useState("");
  const selectVideo = (video, collection) => {
    videoDiagnostic("selection", { id: video.youtubeId || video.videoId, collectionSize: collection.length });
    openedLinkRef.current = video.youtubeId || video.videoId;
    navigate(exploreVideoLocation(location, openedLinkRef.current), { replace: true, state: location.state });
    openVideo(video, collection);
  };
  const linkId = new URLSearchParams(location.search).get("video");
  useEffect(() => {
    if (!linkId) { openedLinkRef.current = null; setLinkStatus(""); return; }
    if (openedLinkRef.current === linkId) return;
    if (activeVideoId === linkId) { openedLinkRef.current = linkId; setLinkStatus(""); return; }
    const curated = exploreVideos(feed.items, "Videos").map(exploreModalVideo);
    const channelVideos = discoveryChannels.flatMap(channel => channel.feed.videos);
    const collection = [...curated, ...channelVideos];
    const result = resolveExploreLink(linkId, collection, feed.loading || discoveryChannels.some(channel => channel.feed.loading));
    if (result.waiting) { setLinkStatus("Loading shared video…"); return; }
    openedLinkRef.current = linkId;
    setLinkStatus(result.error || "");
    if (result.video) openVideo(result.video, curated.includes(result.video) ? curated : channelVideos);
  }, [linkId, feed.items, feed.loading, discoveryChannels, openVideo, activeVideoId]);
  const musicItems = exploreVideos(feed.items, "Music");
  const videoCards = selection => exploreVideos(feed.items, selection).slice(0, selection === "Music" ? (musicExpanded ? undefined : 12) : category === "All" ? 8 : 30).map(item => ({
    id: item.id, title: item.title || "Discover this video", subtitle: item.speaker || item.source_show || "TrueVoice Scroll",
    art: item.thumbnail_url || item.image_url, videoId: item.youtube_id,
    label: selection === "Music" ? "Music video" : "Play video", action: "Play video →", to: scrollDiscoveryLink(item.id),
    onOpen: () => selectVideo(exploreModalVideo(item), exploreVideos(feed.items, selection).map(exploreModalVideo)),
  }));
  const available = discoveryChannels.filter(channel => channel.feed.videos.length > 0);
  const channelCards = creators => available.map(channel => {
    const video = channel.feed.videos[0];
    return { id: channel.id, title: creators ? channel.creator : video.title,
      subtitle: channel.title, art: video.thumbnailUrl, videoId: video.youtubeId,
      label: creators ? "Discover a voice" : "Latest video", action: creators ? "Meet the show →" : "Watch latest →", onOpen: () => selectVideo(video, available.map(channel => channel.feed.videos[0])) };
  });
  const channelLoading = discoveryChannels.some(channel => channel.feed.loading);
  const channelError = discoveryChannels.some(channel => channel.feed.error);
  return <div className="pulse-explore">
    <header className="pulse-explore__intro">
      <p className="pulse-explore__eyebrow">PULSE EXPLORE</p>
      <h1>Find your next connection.</h1>
      <p>Music that moves you. Voices that spark curiosity. Stories that stay with you.</p>
      <span className="pulse-explore__note">Keep LIVE close. Choose a video when you’re ready to watch.</span>
      {linkStatus && <p role="status">{linkStatus}</p>}
    </header>
    <nav className="pulse-explore__filters" aria-label="Discovery categories">
      {EXPLORE_CATEGORIES.map(value => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}
    </nav>
    <div className="pulse-explore__results">
      {sections.music && <DiscoveryRail id="pulse-explore-music" title="Music / In focus" description="Discover artists through curated music videos." cards={videoCards("Music")} loading={feed.loading} error={feed.error} empty="No curated music videos are available yet. Keep listening to LIVE."
        footer={musicItems.length > 12 && <button type="button" className="pulse-discovery__more" aria-expanded={musicExpanded} aria-controls="pulse-explore-music-cards" onClick={() => setMusicExpanded(value => !value)}>{musicExpanded ? "Show Less" : "Show More"}</button>} />}
      {sections.videos && <DiscoveryRail title="Worth watching" description="Selected videos from TrueVoice Scroll." cards={videoCards("Videos")} loading={feed.loading} error={feed.error} empty="No videos are available right now. Check back soon." />}
      {sections.creators && <DiscoveryRail variant="creators" title="Meet the voices" description="Creators and shows with something to say. Select a voice to watch their latest video." cards={channelCards(true)} loading={channelLoading} error={channelError} empty="No creator videos are available right now." />}
      {sections.channels && <DiscoveryRail variant="channels" title="Channels / Go deeper" description="Explore the latest from the TrueVoice channel catalog." cards={channelCards(false)} loading={channelLoading} error={channelError} empty="No channel videos are available right now." />}
      <div className="pulse-explore__podcasts" hidden={!sections.podcasts}><PodcastList /></div>
    </div>
  </div>;
}
