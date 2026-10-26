import { Socket } from 'phoenix';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { RealtimeEvent, type GameResultEvent, type Session } from '@beef/contracts';
import { config } from './config';
import { api } from './store/api';
import { gameResult, matchFound, useAppDispatch, useAppSelector } from './store';

const SocketContext = createContext<Socket | null>(null);

/**
 * One Phoenix socket per signed-in user. It joins the private `user:<id>`
 * channel for pushes (matches, challenges, results) and is shared with chat
 * screens, which join `thread:<id>` channels on the same connection.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token, userId } = useAppSelector((s) => s.auth);
  const dispatch = useAppDispatch();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token || !userId) return;
    const s = new Socket(config.chatWsUrl, { params: { token } });
    s.connect();
    const ch = s.channel(`user:${userId}`);
    ch.on(RealtimeEvent.matchFound, (p: Session) => {
      dispatch(matchFound(p));
      dispatch(api.util.invalidateTags(['Sessions']));
    });
    ch.on(RealtimeEvent.challengeReceived, () => {
      dispatch(api.util.invalidateTags(['Challenges']));
    });
    ch.on(RealtimeEvent.mutualMatch, () => {
      dispatch(api.util.invalidateTags(['Threads']));
    });
    ch.on(RealtimeEvent.gameResult, (p: GameResultEvent) => {
      dispatch(gameResult(p));
      dispatch(api.util.invalidateTags(['Wallet', 'Leaderboard']));
    });
    ch.join();
    setSocket(s);
    return () => {
      ch.leave();
      s.disconnect();
      setSocket(null);
    };
  }, [token, userId, dispatch]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
