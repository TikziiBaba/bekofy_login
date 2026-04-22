// Supabase Client Initialization
// NOTE: In Electron, we load the Supabase JS from a CDN in HTML,
// or we can bundle it. For simplicity, we'll use the global supabase from CDN.

const SUPABASE_URL = 'https://dtdsawyynetqlbosrvqo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHNhd3l5bmV0cWxib3NydnFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDU0MDUsImV4cCI6MjA5MDEyMTQwNX0.6rKxp51OOj_b1iKtz_21ZkHcvbThNF4w5sPdP7RAua4';

let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient) {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.error('Supabase JS library not loaded!');
    }
  }
  return supabaseClient;
}

// ===== Auth Functions =====

async function signUpWithEmail(email, password, username) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  });
  if (data?.user && !error) {
    try {
      await sb.from('profiles').insert({
        id: data.user.id,
        username: username
      });
    } catch (err) {
      console.log('Profile creation warning:', err);
    }
  }

  return { data, error };
}

async function signInWithEmail(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

async function signInWithGoogle() {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'http://localhost'
    }
  });
  return { data, error };
}

async function signInWithApple() {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: 'http://localhost'
    }
  });
  return { data, error };
}

async function signOut() {
  const sb = getSupabase();
  const { error } = await sb.auth.signOut();
  return { error };
}

async function getCurrentUser() {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

async function getSession() {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

// ===== Songs Functions =====

async function fetchAllSongs() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
}

async function searchSongs(query) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .select('*')
    .or(`title.ilike.%${query}%,artist.ilike.%${query}%,album.ilike.%${query}%`)
    .order('title');
  return { data, error };
}

async function getSongUrl(filePath) {
  // Eğer direkt URL ise (http/https), olduğu gibi kullan
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  // Değilse Supabase Storage'dan al
  const sb = getSupabase();
  const { data } = sb.storage
    .from('songs')
    .getPublicUrl(filePath);
  return data.publicUrl;
}

// ===== Playlist Functions =====

async function fetchUserPlaylists(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlists')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data, error };
}

async function createPlaylist(name, userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlists')
    .insert({ name, user_id: userId })
    .select()
    .single();
  return { data, error };
}

async function getPlaylistSongs(playlistId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlist_songs')
    .select(`
      position,
      songs (*)
    `)
    .eq('playlist_id', playlistId)
    .order('position');
  return { data, error };
}

async function addSongToPlaylist(playlistId, songId, position) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlist_songs')
    .insert({ playlist_id: playlistId, song_id: songId, position });
  return { data, error };
}

async function removeSongFromPlaylist(playlistId, songId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('playlist_songs')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('song_id', songId);
  return { error };
}

async function deletePlaylist(playlistId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('playlists')
    .delete()
    .eq('id', playlistId);
  return { error };
}

// ===== Liked Songs =====

async function likeSong(userId, songId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('liked_songs')
    .insert({ user_id: userId, song_id: songId });
  return { data, error };
}

async function unlikeSong(userId, songId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('liked_songs')
    .delete()
    .eq('user_id', userId)
    .eq('song_id', songId);
  return { error };
}

async function isLiked(userId, songId) {
  const sb = getSupabase();
  const { data } = await sb
    .from('liked_songs')
    .select('song_id')
    .eq('user_id', userId)
    .eq('song_id', songId)
    .single();
  return !!data;
}

async function fetchLikedSongs(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('liked_songs')
    .select(`
      song_id,
      songs (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data, error };
}

// ===== Realtime =====

function subscribeToSongs(callback) {
  const sb = getSupabase();
  return sb
    .channel('songs-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, callback)
    .subscribe();
}

// ===== Role & Admin Functions =====

async function fetchUserRole(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (error || !data) return 'user';
  return data.role || 'user';
}

async function updateUserRole(userId, newRole) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
}

async function fetchAllProfiles() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
}

async function getDashboardStats() {
  const sb = getSupabase();
  
  const [profilesRes, songsRes, playlistsRes] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('songs').select('id', { count: 'exact', head: true }),
    sb.from('playlists').select('id', { count: 'exact', head: true }),
  ]);
  
  return {
    users: profilesRes.count || 0,
    songs: songsRes.count || 0,
    playlists: playlistsRes.count || 0,
  };
}

async function addSong(songData) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .insert(songData)
    .select()
    .single();
  return { data, error };
}

async function deleteSong(songId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('songs')
    .delete()
    .eq('id', songId);
  return { error };
}

// ===== Profile Functions =====

async function fetchProfile(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
}

async function updateProfile(userId, updates) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
}

// ===== Song Approval System =====

async function submitSongForApproval(songData) {
  const sb = getSupabase();
  songData.status = 'pending';
  const { data, error } = await sb
    .from('songs')
    .insert(songData)
    .select()
    .single();
  return { data, error };
}

async function fetchPendingSongs() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return { data, error };
}

async function approveSong(songId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .update({ status: 'approved' })
    .eq('id', songId)
    .select()
    .single();
  return { data, error };
}

async function rejectSong(songId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('songs')
    .delete()
    .eq('id', songId);
  return { error };
}

async function fetchApprovedSongs() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .select('*')
    .or('status.eq.approved,status.is.null')
    .order('created_at', { ascending: false });
  return { data, error };
}

// ===== Playlist Enhanced Functions =====

async function updatePlaylist(playlistId, updates) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlists')
    .update(updates)
    .eq('id', playlistId)
    .select()
    .single();
  return { data, error };
}

async function fetchPlaylistById(playlistId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlists')
    .select('*')
    .eq('id', playlistId)
    .single();
  return { data, error };
}

async function searchPublicPlaylists(query) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlists')
    .select('*, profiles(username, avatar_url)')
    .eq('is_public', true)
    .ilike('name', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20);
  return { data, error };
}

// ===== Friend System =====

async function searchUsers(query) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { data: [], error: null };

  // Search profiles
  const profilesRes = await sb.from('profiles')
    .select('id, username, avatar_url, role, is_banned')
    .neq('id', user.id)
    .ilike('username', `%${query}%`)
    .limit(20);
  
  // Search artists table separately with try/catch
  let artistsData = [];
  try {
    const artistsRes = await sb.from('artists')
      .select('id, name, avatar_url')
      .ilike('name', `%${query}%`)
      .limit(10);
    artistsData = artistsRes.data || [];
  } catch (e) {
    console.log('Artists search error:', e);
  }
  
  const profileUsers = profilesRes.data || [];
  
  // Add artists from artists table (that aren't already in profiles results)
  const profileNames = new Set(profileUsers.map(p => (p.username || '').toLowerCase()));
  const artistUsers = artistsData
    .filter(a => !profileNames.has((a.name || '').toLowerCase()))
    .map(a => ({
      id: a.id,
      username: a.name,
      avatar_url: a.avatar_url,
      role: 'artist',
      is_banned: false
    }));
  
  return { data: [...profileUsers, ...artistUsers], error: profilesRes.error };
}

async function addFriend(friendId) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { data: null, error: { message: 'Giriş yapılmalı' } };

  const { data, error } = await sb
    .from('friendships')
    .insert([{ user_id: user.id, friend_id: friendId, status: 'accepted' }]);
    
  return { data, error };
}

async function removeFriend(friendId) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { data: null, error: { message: 'Giriş yapılmalı' } };

  const { data, error } = await sb
    .from('friendships')
    .delete()
    .eq('user_id', user.id)
    .eq('friend_id', friendId);
    
  return { data, error };
}

// ===== Block & Public User System =====

async function fetchUserPublicProfile(userId) {
  const sb = getSupabase();
  
  // Check if blocked first
  const isBlocked = await checkIfBlockedInternal(userId);
  if (isBlocked) return { data: null, error: { message: 'Bu profil bulunamadı veya gizli.' } };
  
  // Fetch profile
  let profile, profileError;
  const res1 = await sb
    .from('profiles')
    .select('id, username, avatar_url, role, banner_url')
    .eq('id', userId)
    .single();
  if (res1.error && res1.error.message && res1.error.message.includes('banner_url')) {
    // Fallback if banner_url column doesn't exist
    const res2 = await sb
      .from('profiles')
      .select('id, username, avatar_url, role')
      .eq('id', userId)
      .single();
    profile = res2.data;
    profileError = res2.error;
  } else {
    profile = res1.data;
    profileError = res1.error;
  }
    
  if (profileError) return { data: null, error: profileError };
  
  // Fetch followers count
  const { count: followersCount } = await sb
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('friend_id', userId)
    .eq('status', 'accepted');
    
  // Fetch public playlists count
  const { count: playlistsCount } = await sb
    .from('playlists')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_public', true);
    
  // Check friendship status
  const isFriend = await checkFriendshipInternal(userId);
    
  return { 
    data: { 
      ...profile, 
      followers_count: followersCount || 0,
      playlists_count: playlistsCount || 0,
      is_following: isFriend
    }, 
    error: null 
  };
}

async function blockUser(blockedId) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { data: null, error: { message: 'Geçersiz oturum' } };

  // Remove friendship if exists (both ways)
  await sb.from('friendships').delete().or(`and(user_id.eq.${user.id},friend_id.eq.${blockedId}),and(user_id.eq.${blockedId},friend_id.eq.${user.id})`);

  // Insert block
  const { data, error } = await sb
    .from('blocked_users')
    .insert([{ user_id: user.id, blocked_id: blockedId }]);
    
  return { data, error };
}

async function unblockUser(blockedId) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { data: null, error: { message: 'Geçersiz oturum' } };

  const { data, error } = await sb
    .from('blocked_users')
    .delete()
    .eq('user_id', user.id)
    .eq('blocked_id', blockedId);
    
  return { data, error };
}

async function checkIfBlockedInternal(targetUserId) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;

  // Check if I blocked them OR they blocked me
  const { data, error } = await sb
    .from('blocked_users')
    .select('id')
    .or(`and(user_id.eq.${user.id},blocked_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},blocked_id.eq.${user.id})`)
    .limit(1);

  if (error || !data || data.length === 0) return false;
  return true;
}

async function checkFriendshipInternal(targetUserId) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;

  const { data, error } = await sb
    .from('friendships')
    .select('id')
    .eq('user_id', user.id)
    .eq('friend_id', targetUserId)
    .limit(1);

  if (error || !data || data.length === 0) return false;
  return true;
}


async function uploadPlaylistCover(playlistId, file) {
  const sb = getSupabase();
  const ext = file.name.split('.').pop();
  
  // Get current user's ID for storage policy compatibility
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { data: null, error: { message: 'Oturum bulunamadı' } };
  
  // Use folder path matching user ID for Supabase Storage RLS policy compatibility
  const fileName = `${user.id}/playlist-${playlistId}-${Date.now()}.${ext}`;
  
  try {
    const { error: uploadError } = await sb.storage
      .from('avatars')
      .upload(fileName, file, { 
        upsert: true,
        contentType: file.type
      });
      
    if (uploadError) {
      console.error('Cover upload error:', JSON.stringify(uploadError));
      return { data: null, error: uploadError };
    }
    
    const { data: urlData } = sb.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    // Update the playlist row in the database since the user might complain it doesn't persist
    const coverUrl = urlData.publicUrl + '?t=' + Date.now();
    await sb.from('playlists').update({ cover_url: coverUrl }).eq('id', playlistId);
    
    return { data: coverUrl, error: null };
  } catch (err) {
    console.error('Cover upload exception:', err);
    return { data: null, error: err };
  }
}

// ===== Play History (for recommendations) =====

async function recordPlay(userId, songId) {
  const sb = getSupabase();
  // Upsert to play_history or simply track in liked_songs context
  // For now, we'll use liked_songs + artist matching for recommendations
  return;
}

async function getRecommendedSongs(userId, allSongs, likedSongIds) {
  // Algoritma:
  // 1. Beğenilen şarkıların sanatçılarını bul
  // 2. Bu sanatçıların beğenilmemiş şarkılarını öner
  // 3. Yeterli değilse rastgele şarkılar ekle
  
  const likedSongs = allSongs.filter(s => likedSongIds.has(s.id));
  const likedArtists = new Set(likedSongs.map(s => s.artist?.toLowerCase()));
  const likedAlbums = new Set(likedSongs.filter(s => s.album).map(s => s.album?.toLowerCase()));
  
  let recommended = [];
  
  // Beğenilen sanatçıların diğer şarkıları
  if (likedArtists.size > 0) {
    const artistMatches = allSongs.filter(s => 
      !likedSongIds.has(s.id) && 
      likedArtists.has(s.artist?.toLowerCase())
    );
    recommended.push(...artistMatches);
  }
  
  // Beğenilen albümlerin diğer şarkıları
  if (likedAlbums.size > 0) {
    const albumMatches = allSongs.filter(s => 
      !likedSongIds.has(s.id) && 
      !recommended.find(r => r.id === s.id) &&
      s.album && likedAlbums.has(s.album.toLowerCase())
    );
    recommended.push(...albumMatches);
  }
  
  // Karıştır
  recommended = recommended.sort(() => Math.random() - 0.5);
  
  // Yeterli değilse, hiç beğenilmemiş rastgele şarkılar ekle
  if (recommended.length < 8) {
    const remaining = allSongs.filter(s => 
      !likedSongIds.has(s.id) && 
      !recommended.find(r => r.id === s.id)
    ).sort(() => Math.random() - 0.5);
    recommended.push(...remaining.slice(0, 8 - recommended.length));
  }
  
  return recommended.slice(0, 8);
}

// ===== Reserved Usernames (Admin) =====

async function fetchReservedUsernames() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('reserved_usernames')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
}

async function addReservedUsername(username, addedBy) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('reserved_usernames')
    .insert({ username: username.toLowerCase().trim(), added_by: addedBy })
    .select()
    .single();
  return { data, error };
}

async function removeReservedUsername(id) {
  const sb = getSupabase();
  const { error } = await sb
    .from('reserved_usernames')
    .delete()
    .eq('id', id);
  return { error };
}

async function isUsernameReserved(username) {
  const sb = getSupabase();
  const { data } = await sb
    .from('reserved_usernames')
    .select('id')
    .eq('username', username.toLowerCase().trim())
    .maybeSingle();
  return !!data;
}

// ===== Admin: Ban/Delete Users =====

async function adminBanUser(userId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('profiles')
    .update({ is_banned: true })
    .eq('id', userId);
  return { error };
}

async function adminUnbanUser(userId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('profiles')
    .update({ is_banned: false })
    .eq('id', userId);
  return { error };
}

async function adminDeleteUser(userId) {
  const sb = getSupabase();
  // Delete profile (cascade will handle related data)
  const { error: profileError } = await sb
    .from('profiles')
    .delete()
    .eq('id', userId);
  return { error: profileError };
}

// ===== Friend System =====

async function sendFriendRequest(userId, friendId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('friendships')
    .insert({ user_id: userId, friend_id: friendId, status: 'pending' })
    .select()
    .single();
  return { data, error };
}

async function acceptFriendRequest(friendshipId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);
  return { error };
}

async function rejectFriendRequest(friendshipId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('friendships')
    .delete()
    .eq('id', friendshipId);
  return { error };
}



async function fetchFriends(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('friendships')
    .select('*, profiles!friendships_friend_id_fkey(id, username, avatar_url, role)')
    .eq('user_id', userId)
    .eq('status', 'accepted');
  
  // Also fetch where user is friend_id
  const { data: data2 } = await sb
    .from('friendships')
    .select('*, profiles!friendships_user_id_fkey(id, username, avatar_url, role)')
    .eq('friend_id', userId)
    .eq('status', 'accepted');
  
  return { data: [...(data || []), ...(data2 || [])], error };
}

async function fetchPendingFriendRequests(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('friendships')
    .select('*, profiles!friendships_user_id_fkey(id, username, avatar_url, role)')
    .eq('friend_id', userId)
    .eq('status', 'pending');
  return { data, error };
}

async function fetchBlockedUsers(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('blocked_users')
    .select('*, profiles!blocked_users_blocked_id_fkey(id, username, avatar_url)')
    .eq('user_id', userId);
  return { data, error };
}

// ===== Artist Lookup =====

async function getArtistProfiles() {
  const sb = getSupabase();
  // Fetch from both profiles (role=artist) and artists table
  const [profilesRes, artistsRes] = await Promise.all([
    sb.from('profiles').select('id, username, avatar_url, role').eq('role', 'artist'),
    sb.from('artists').select('id, name, avatar_url').catch(() => ({ data: [], error: null }))
  ]);
  
  const profileArtists = (profilesRes.data || []).map(p => ({
    id: p.id,
    name: p.username,
    avatar_url: p.avatar_url,
    source: 'profiles'
  }));
  
  const tableArtists = (artistsRes.data || []).map(a => ({
    id: a.id,
    name: a.name,
    avatar_url: a.avatar_url,
    source: 'artists'
  }));
  
  // Merge: avoid duplicates by name (case-insensitive)
  const seen = new Set();
  const merged = [];
  for (const a of [...profileArtists, ...tableArtists]) {
    const key = (a.name || '').toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(a);
    }
  }
  
  return { data: merged, error: profilesRes.error };
}

async function getArtistByName(artistName) {
  const sb = getSupabase();
  // Try profiles first
  const { data: profileData } = await sb
    .from('profiles')
    .select('id, username, avatar_url, bio, role')
    .eq('role', 'artist')
    .ilike('username', artistName)
    .maybeSingle();
  
  if (profileData) {
    return { id: profileData.id, name: profileData.username, avatar_url: profileData.avatar_url, bio: profileData.bio, source: 'profiles' };
  }
  
  // Try artists table
  const { data: artistData } = await sb
    .from('artists')
    .select('id, name, avatar_url')
    .ilike('name', artistName)
    .maybeSingle();
  
  if (artistData) {
    return { id: artistData.id, name: artistData.name, avatar_url: artistData.avatar_url, bio: null, source: 'artists' };
  }
  
  return null;
}

async function getSongsByArtist(artistName) {
  const sb = getSupabase();
  // Search for exact match or as part of multi-artist (comma separated)
  const { data, error } = await sb
    .from('songs')
    .select('*')
    .or(`artist.ilike.${artistName},artist.ilike.%${artistName}%`)
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

// ===== Lyrics Functions =====

async function fetchLyricsFromAPI(title, artist, album, duration) {
  try {
    // Try exact match first with /api/get
    if (album && duration) {
      const params = new URLSearchParams({
        track_name: title,
        artist_name: artist,
        album_name: album,
        duration: Math.round(duration).toString()
      });
      const resp = await fetch(`https://lrclib.net/api/get?${params}`, {
        headers: { 'User-Agent': 'Bekofy/1.1.0 (https://bekofy.app)' }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && (data.plainLyrics || data.syncedLyrics)) {
          return { plainLyrics: data.plainLyrics || null, syncedLyrics: data.syncedLyrics || null };
        }
      }
    }

    // Fallback: search by track name and artist
    const searchParams = new URLSearchParams({
      track_name: title,
      artist_name: artist
    });
    const searchResp = await fetch(`https://lrclib.net/api/search?${searchParams}`, {
      headers: { 'User-Agent': 'Bekofy/1.1.0 (https://bekofy.app)' }
    });
    if (searchResp.ok) {
      const results = await searchResp.json();
      if (results && results.length > 0) {
        // Pick best match (first result with lyrics)
        const best = results.find(r => r.syncedLyrics || r.plainLyrics) || results[0];
        return { plainLyrics: best.plainLyrics || null, syncedLyrics: best.syncedLyrics || null };
      }
    }

    // Last fallback: search with just the query string
    const qParams = new URLSearchParams({ q: `${artist} ${title}` });
    const qResp = await fetch(`https://lrclib.net/api/search?${qParams}`, {
      headers: { 'User-Agent': 'Bekofy/1.1.0 (https://bekofy.app)' }
    });
    if (qResp.ok) {
      const qResults = await qResp.json();
      if (qResults && qResults.length > 0) {
        const best = qResults.find(r => r.syncedLyrics || r.plainLyrics) || qResults[0];
        return { plainLyrics: best.plainLyrics || null, syncedLyrics: best.syncedLyrics || null };
      }
    }

    return null;
  } catch (err) {
    console.error('Lyrics API error:', err);
    return null;
  }
}

async function saveLyricsToDb(songId, lyrics, syncedLyrics) {
  const sb = getSupabase();
  try {
    const { error } = await sb
      .from('songs')
      .update({ lyrics: lyrics, synced_lyrics: syncedLyrics })
      .eq('id', songId);
    if (error) console.error('Save lyrics error:', error);
  } catch (err) {
    console.error('Save lyrics exception:', err);
  }
}

async function getLyrics(song) {
  if (!song) return null;

  // 1. Check if lyrics already cached in DB
  if (song.lyrics || song.synced_lyrics) {
    return { plainLyrics: song.lyrics || null, syncedLyrics: song.synced_lyrics || null };
  }

  // 2. Check DB for latest data (in case it was updated)
  const sb = getSupabase();
  try {
    const { data } = await sb
      .from('songs')
      .select('lyrics, synced_lyrics')
      .eq('id', song.id)
      .single();
    if (data && (data.lyrics || data.synced_lyrics)) {
      return { plainLyrics: data.lyrics || null, syncedLyrics: data.synced_lyrics || null };
    }
  } catch (e) {
    // Continue to API fetch
  }

  // 3. Fetch from LRCLIB API
  const result = await fetchLyricsFromAPI(
    song.title,
    song.artist,
    song.album || '',
    song.duration || 0
  );

  // 4. Cache in DB if found
  if (result && (result.plainLyrics || result.syncedLyrics)) {
    await saveLyricsToDb(song.id, result.plainLyrics, result.syncedLyrics);
    return result;
  }

  return null;
}
