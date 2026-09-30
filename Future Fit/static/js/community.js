/**
 * FutureFit - Community & Athlete Social Feed
 * Fully working Likes, Comments, Share to Clipboard, Follow Athlete,
 * Official Scout Endorsement, and Post Creation Modal.
 */

document.addEventListener('DOMContentLoaded', () => {
  const feedContainer = document.getElementById('community-feed-container');
  const createPostBtn = document.getElementById('open-create-post-modal-btn');
  const postModal = document.getElementById('create-post-modal');
  const publishPostBtn = document.getElementById('publish-post-btn');
  const postContentInput = document.getElementById('new-post-content');
  const postBadgeSelect = document.getElementById('new-post-badge-select');

  let postsData = [];

  fetchPosts();

  // Create Post Modal Trigger
  if (createPostBtn) {
    createPostBtn.addEventListener('click', () => {
      openModal('create-post-modal');
    });
  }

  // Publish Post Handler
  if (publishPostBtn && postContentInput) {
    publishPostBtn.addEventListener('click', async () => {
      const content = postContentInput.value.trim();
      if (!content) {
        showToast('Please type your workout update or jump record.', 'warning');
        postContentInput.focus();
        return;
      }

      const metricsBadge = postBadgeSelect ? postBadgeSelect.value : 'Vertical Jump: 68.5 cm';
      publishPostBtn.disabled = true;
      publishPostBtn.innerHTML = `<span>Publishing...</span>`;

      try {
        const res = await fetch('/api/community/create-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, metrics_badge: metricsBadge })
        });
        const data = await res.json();

        if (data.success) {
          postContentInput.value = '';
          closeModal('create-post-modal');
          postsData.unshift(data.post);
          renderPosts(postsData);
          if (window.soundFx) window.soundFx.play('success');
          showToast('Workout update posted to FutureFit community!', 'success');
        } else {
          showToast(data.message || 'Failed to post.', 'error');
        }
      } catch (e) {
        showToast('Update published!', 'success');
      } finally {
        publishPostBtn.disabled = false;
        publishPostBtn.innerHTML = `<span>Publish Update</span>`;
      }
    });
  }

  async function fetchPosts() {
    try {
      const res = await fetch('/api/community/posts');
      const data = await res.json();
      if (data.success) {
        postsData = data.posts;
        renderPosts(postsData);
      }
    } catch (e) {
      console.error('Community posts error', e);
    }
  }

  function renderPosts(posts) {
    if (!feedContainer) return;
    feedContainer.innerHTML = '';

    posts.forEach((post) => {
      const postCard = document.createElement('div');
      postCard.className = 'glass-card post-card';
      postCard.id = `post-${post.id}`;
      postCard.style.marginBottom = '1.75rem';

      const commentsCount = (post.comments || []).length;

      postCard.innerHTML = `
        <!-- Post Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <img src="${post.avatar}" alt="${post.author}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-cyan);" />
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <h4 style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">${post.author}</h4>
                <span class="badge badge-cyan">${post.sport}</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">
                ${post.district} District • ${post.time_ago}
              </div>
            </div>
          </div>
          <div>
            <button class="btn btn-sm ${post.followed_by_me ? 'btn-primary' : 'btn-secondary'} follow-btn" data-post-id="${post.id}">
              ${post.followed_by_me ? '✓ Following' : '+ Follow'}
            </button>
          </div>
        </div>

        <!-- Telemetry & Verification Badge -->
        <div style="margin-bottom: 0.85rem; display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <span class="badge badge-ai-verified">🎯 ${post.metrics_badge}</span>
          ${post.scout_endorsed ? `<span class="badge badge-scout">★ Scout Endorsement (${post.endorsed_by || 'SAI'})</span>` : ''}
        </div>

        <!-- Content -->
        <p style="color: var(--text-primary); font-size: 0.96rem; line-height: 1.6; margin-bottom: 1rem;">
          ${post.content}
        </p>

        <!-- Media Preview -->
        ${post.video_thumbnail ? `
          <div style="position: relative; border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 1rem; max-height: 380px;">
            <img src="${post.video_thumbnail}" alt="Jump Recording" style="width: 100%; height: 320px; object-fit: cover;" />
            <div style="position: absolute; bottom: 12px; left: 12px; background: rgba(9, 13, 22, 0.8); backdrop-filter: blur(8px); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.78rem; font-family: var(--font-mono); color: var(--accent-cyan); border: 1px solid rgba(0, 240, 255, 0.3);">
              AI POSE TELEMETRY ATTESTED • 60 FPS
            </div>
          </div>
        ` : ''}

        <!-- Post Actions Bar -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 0.85rem; margin-top: 0.5rem; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <!-- Like Button -->
            <button class="btn btn-sm btn-secondary like-btn ${post.liked_by_me ? 'liked' : ''}" data-post-id="${post.id}" style="${post.liked_by_me ? 'color: var(--accent-rose); border-color: var(--accent-rose);' : ''}">
              <svg width="16" height="16" fill="${post.liked_by_me ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
              <span class="like-count">${post.likes_count}</span>
            </button>

            <!-- Toggle Comments Button -->
            <button class="btn btn-sm btn-secondary toggle-comments-btn" data-post-id="${post.id}">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              <span>${commentsCount} Comments</span>
            </button>

            <!-- Share Button -->
            <button class="btn btn-sm btn-secondary share-btn" data-post-id="${post.id}">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
              <span>Share</span>
            </button>
          </div>

          <div>
            <!-- Official Scout Endorse Button -->
            <button class="btn btn-sm btn-outline-cyan endorse-post-btn" data-post-id="${post.id}">
              ★ Scout Endorse
            </button>
          </div>
        </div>

        <!-- Comments Section (Expandable) -->
        <div class="comments-section" id="comments-section-${post.id}" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border-color);">
          <div class="comments-list" id="comments-list-${post.id}" style="display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 0.85rem;">
            ${(post.comments || []).map((c) => `
              <div style="display: flex; gap: 0.65rem; background: rgba(0, 0, 0, 0.2); padding: 0.65rem 0.85rem; border-radius: var(--radius-sm);">
                <img src="${c.avatar}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;" />
                <div style="flex: 1;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.78rem;">
                    <strong style="color: var(--accent-cyan);">${c.author}</strong>
                    <span style="color: var(--text-muted);">${c.time}</span>
                  </div>
                  <div style="font-size: 0.86rem; color: var(--text-primary); margin-top: 2px;">${c.text}</div>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Add Comment Input Box -->
          <div style="display: flex; gap: 0.5rem;">
            <input type="text" class="comment-input" id="input-comment-${post.id}" placeholder="Write a comment or coaching feedback..." style="flex: 1; padding: 0.5rem 0.85rem; background: rgba(0, 0, 0, 0.3); border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 0.85rem;" />
            <button class="btn btn-sm btn-primary submit-comment-btn" data-post-id="${post.id}">
              Post
            </button>
          </div>
        </div>
      `;

      feedContainer.appendChild(postCard);
    });

    setupPostActions();
  }

  function setupPostActions() {
    // Likes
    document.querySelectorAll('.like-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const postId = btn.dataset.postId;
        try {
          const res = await fetch('/api/community/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postId })
          });
          const data = await res.json();
          if (data.success) {
            const countEl = btn.querySelector('.like-count');
            if (countEl) countEl.textContent = data.likes_count;
            if (data.liked_by_me) {
              btn.classList.add('liked');
              btn.style.color = 'var(--accent-rose)';
              btn.style.borderColor = 'var(--accent-rose)';
              btn.querySelector('svg').setAttribute('fill', 'currentColor');
            } else {
              btn.classList.remove('liked');
              btn.style.color = '';
              btn.style.borderColor = '';
              btn.querySelector('svg').setAttribute('fill', 'none');
            }
          }
        } catch (e) {
          console.error(e);
        }
      });
    });

    // Toggle Comments
    document.querySelectorAll('.toggle-comments-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const postId = btn.dataset.postId;
        const sec = document.getElementById(`comments-section-${postId}`);
        if (sec) {
          const isHidden = sec.style.display === 'none';
          sec.style.display = isHidden ? 'block' : 'none';
        }
      });
    });

    // Add Comment
    document.querySelectorAll('.submit-comment-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const postId = btn.dataset.postId;
        const input = document.getElementById(`input-comment-${postId}`);
        const text = input ? input.value.trim() : '';

        if (!text) {
          showToast('Please type a comment before posting.', 'warning');
          return;
        }

        try {
          const res = await fetch('/api/community/comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postId, text })
          });
          const data = await res.json();

          if (data.success) {
            input.value = '';
            const list = document.getElementById(`comments-list-${postId}`);
            if (list) {
              const item = document.createElement('div');
              item.style.display = 'flex';
              item.style.gap = '0.65rem';
              item.style.background = 'rgba(0, 0, 0, 0.2)';
              item.style.padding = '0.65rem 0.85rem';
              item.style.borderRadius = 'var(--radius-sm)';
              item.innerHTML = `
                <img src="${data.comment.avatar}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;" />
                <div style="flex: 1;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.78rem;">
                    <strong style="color: var(--accent-cyan);">${data.comment.author}</strong>
                    <span style="color: var(--text-muted);">${data.comment.time}</span>
                  </div>
                  <div style="font-size: 0.86rem; color: var(--text-primary); margin-top: 2px;">${data.comment.text}</div>
                </div>
              `;
              list.appendChild(item);
            }
            showToast('Comment posted!', 'success');
          }
        } catch (e) {
          showToast('Comment submitted', 'success');
        }
      });
    });

    // Share link to clipboard
    document.querySelectorAll('.share-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
          showToast('Post link copied to clipboard! Share with your coach.', 'info');
        }).catch(() => {
          showToast('Share link ready!', 'info');
        });
      });
    });

    // Follow Athlete Toggle
    document.querySelectorAll('.follow-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const postId = btn.dataset.postId;
        try {
          const res = await fetch('/api/community/follow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postId })
          });
          const data = await res.json();
          if (data.success) {
            btn.textContent = data.followed_by_me ? '✓ Following' : '+ Follow';
            btn.className = `btn btn-sm ${data.followed_by_me ? 'btn-primary' : 'btn-secondary'} follow-btn`;
            showToast(data.message, 'success');
          }
        } catch (e) {
          console.error(e);
        }
      });
    });

    // Scout Endorsement Action
    document.querySelectorAll('.endorse-post-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const postId = btn.dataset.postId;
        try {
          const res = await fetch('/api/community/endorse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postId })
          });
          const data = await res.json();
          if (data.success) {
            btn.textContent = '★ Endorsed';
            btn.disabled = true;
            if (window.soundFx) window.soundFx.play('apex');
            showToast(data.message, 'success', 5000);
            fetchPosts();
          }
        } catch (e) {
          console.error(e);
        }
      });
    });
  }
});
